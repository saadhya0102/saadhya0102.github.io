// --- STATE MANAGEMENT ---
let allBooks = [];
let filteredBooks = [];
let currentPage = 1;
const itemsPerPage = 10;
const IMAGE_DIR = 'books_images';

let selectedTags = new Set();

let currentQuery = {
    searchTerm: '',
    sortBy: 'recent', 
    maxRating: 0 // Default: 10 out of 10 (5 stars), shows everything
};

// --- INITIALIZATION ---
function normalizeImagePath(imagePath) {
    if (!imagePath) return '';

    let clean = imagePath.trim().replace(/\\/g, '/');
    const lower = clean.toLowerCase();

    // if JSON has `.jpeg` but files are `.jpg`, normalize
    if (lower.endsWith('.jpeg')) {
        clean = clean.slice(0, -5) + '.jpg';
    }

    // remove ./ prefix
    if (clean.startsWith('./')) {
        clean = clean.slice(2);
    }
    // remove leading slash
    if (clean.startsWith('/')) {
        clean = clean.slice(1);
    }

    // Keep absolute URLs / data URIs untouched
    if (/^(https?:\/\/|data:)/i.test(clean)) {
        return clean;
    }

    // if no directory specified, add IMAGE_DIR
    if (!clean.startsWith(IMAGE_DIR + '/')) {
        clean = `${IMAGE_DIR}/${clean}`;
    }

    return clean;
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('books.json');
        const rawBooks = await response.json();

        // Remove leftover rank and fix jpeg paths
        allBooks = rawBooks.map(book => {
            const { rank, ...rest } = book;
            if (rest.image) {
                rest.image = normalizeImagePath(rest.image);
            }
            return rest;
        });

        populateTags();
        applyFiltersAndSort();
        setupEventListeners();
        updateFilterStars();
        
        window.addEventListener('hashchange', handleRouting);
        handleRouting(); 
    } catch (error) {
        console.error("Error loading the library:", error);
        document.getElementById('book-list-container').innerHTML = '<p>Could not load books. Check console.</p>';
    }
});

// --- ROUTING ENGINE ---
function handleRouting() {
    const hash = window.location.hash;
    
    document.getElementById('search-view').style.display = 'none';
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('about-view').style.display = 'none';
    document.getElementById('detail-view').style.display = 'none';

    if (hash.startsWith('#book-')) {
        const bookId = hash.replace('#book-', '');
        renderSingleBook(bookId);
    } else if (hash === '#about') {
        document.getElementById('about-view').style.display = 'block';
    } else {
        document.getElementById('search-view').style.display = 'block';
        document.getElementById('list-view').style.display = 'block';
    }
}

// --- HELPER FUNCTIONS ---
function calculateStarPercentage(ratingOutOf10) {
    const starsToFill = ratingOutOf10 / 2; 
    const gapRatio = 0.25; 
    
    const fullStars = Math.floor(starsToFill);
    const fractionalStar = starsToFill - fullStars;
    
    const totalWidthUnits = 5 + (4 * gapRatio); 
    let filledUnits = fullStars * (1 + gapRatio) + fractionalStar;
    
    if (fullStars >= 5) filledUnits = totalWidthUnits;
    
    return (filledUnits / totalWidthUnits) * 100;
}

function getStarsHTML(ratingOutOf10) {
    const percentage = calculateStarPercentage(ratingOutOf10);
    return `
    <div class="stars-outer">
      <div class="stars-inner" style="width: ${percentage}%"></div>
    </div>`;
}

function evaluateQuery(book, query) {
    if (!query.trim()) return true;

    let q = query.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ');
    q = q.replace(/\band\b/gi, '&&')
         .replace(/\bor\b/gi, '||')
         .replace(/\bnot\b/gi, '!');

    const termRegex = /(author:[\w-]+|tag:[\w-]+|"[^"]+"|[^\s&|!()]+)/gi;

    let evalString = q.replace(termRegex, (match) => {
        const lowerMatch = match.toLowerCase();
        let isTrue = false;

        if (lowerMatch.startsWith('author:')) {
            const val = lowerMatch.substring(7);
            isTrue = book.author.toLowerCase().includes(val);
        } else if (lowerMatch.startsWith('tag:')) {
            const val = lowerMatch.substring(4);
            isTrue = book.tags.some(t => t.toLowerCase() === val);
        } else if (lowerMatch.startsWith('"') && lowerMatch.endsWith('"')) {
            const val = lowerMatch.slice(1, -1);
            isTrue = book.title.toLowerCase().includes(val) || 
                     book.author.toLowerCase().includes(val) || 
                     (book.synopsis && book.synopsis.toLowerCase().includes(val));
        } else {
            isTrue = book.title.toLowerCase().includes(lowerMatch) || 
                     book.author.toLowerCase().includes(lowerMatch);
        }
        return isTrue ? 'true' : 'false';
    });

    try {
        if (!/^[truefalse\s&|!()]+$/.test(evalString)) return false;
        return Function('"use strict";return (' + evalString + ')')();
    } catch (e) {
        return false;
    }
}

function getSimilarBooks(targetBook) {
    return allBooks
        .filter(b => b.id !== targetBook.id)
        .map(b => {
            const overlapCount = b.tags.filter(t => targetBook.tags.includes(t)).length;
            const ratingDiff = Math.abs(b.overallRating - targetBook.overallRating);
            const authorBonus = (b.author === targetBook.author) ? 100 : 0;
            const score = (overlapCount * 10) - (ratingDiff * 2) + authorBonus;
            return { book: b, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 7) 
        .map(item => item.book);
}

// --- CORE FILTER & SORT ---
function applyFiltersAndSort() {
    filteredBooks = allBooks.filter(book => {
        if (book.overallRating < currentQuery.maxRating) return false;

        if (selectedTags.size > 0) {
            const hasAllTags = Array.from(selectedTags).every(t => book.tags.includes(t));
            if (!hasAllTags) return false;
        }

        return evaluateQuery(book, currentQuery.searchTerm);
    });

    if (currentQuery.sortBy === 'recent') {
        filteredBooks.sort((a, b) => new Date(b.dateRead) - new Date(a.dateRead));
    } else if (currentQuery.sortBy === 'top') {
        filteredBooks.sort((a, b) => b.overallRating - a.overallRating);
    }
    if (currentQuery.sortBy === 'random') {
        filteredBooks.sort(() => Math.random() - 0.5);
    }
    currentPage = 1;
    renderBookList();
}

// --- RENDERING VIEWS ---
function renderBookList() {
    const container = document.getElementById('book-list-container');
    container.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const booksToShow = filteredBooks.slice(start, end);

    if (booksToShow.length === 0) {
        container.innerHTML = '<p style="color:#d4af37;">No books match your criteria.</p>';
    }

    booksToShow.forEach(book => {
        const imageHTML = book.image && book.image !== "" 
            ? `<img src="${book.image}" alt="${book.title}" style="max-width: 150px; border-radius: 4px;">` 
            : `<div style="width: 150px; height: 225px; background-color: #333; border: 1px solid #444; display:flex; align-items:center; justify-content:center; color:#888; text-align:center; font-size:0.8rem;">No Image</div>`;

        let snippet = book.synopsis ? book.synopsis.split('. ')[0] : "No synopsis provided";
        if (book.synopsis && book.synopsis.includes('. ')) snippet += '.';
        if (snippet.length > 120) snippet = snippet.substring(0, 120) + '...';

        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.cssText = "width: 100%; box-sizing: border-box;"; 
        
        card.innerHTML = `
            ${imageHTML}
            <div class="book-info-short" style="width: 100%; min-width: 0; display: flex; flex-direction: column;">
                
                <div style="display: flex; justify-content: space-between; width: 100%;">
                    <div style="flex: 1; min-width: 0; padding-right: 20px;">
                        <h2 style="margin: 0; color: #d4af37; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${book.title}</h2>
                        <p style="margin: 5px 0 10px 0; color: #ccc;"><em>by ${book.author}</em></p>
                    </div>
                    <div style="flex: 1; min-width: 0; text-align: right; color: #888; font-size: 0.9em; font-style: italic; display: flex; justify-content: flex-end;">
                        <span style="max-width: 100%; word-wrap: break-word;">${snippet}</span>
                    </div>
                </div>
                
                <div class="subratings-box" style="margin-top: auto; padding-top: 10px; display: flex; align-items: center;">
                    ${getStarsHTML(book.overallRating)}
                </div>
                
                <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-end; width: 100%;">
                    <div style="flex: 1; min-width: 0; padding-right: 15px;">
                        <p style="font-size: 0.85em; color: #aaa; margin: 0 0 5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong>Tags:</strong> ${(book.tags || []).join(', ')}</p>
                        <span style="font-size: 0.8em; color: #666;">Read: ${book.dateRead || 'Unknown'}</span>
                    </div>
                    <button class="btn-gold more-info-btn" onclick="window.location.hash='book-${book.id}'" style="flex-shrink: 0;">More Info</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    updatePagination();
}

function renderSingleBook(id) {
    const book = allBooks.find(b => b.id === id);
    if (!book) return;

    document.getElementById('detail-view').style.display = 'block';
    window.scrollTo(0, 0);

    const container = document.getElementById('single-book-container');
    const imageHTML = book.image && book.image !== "" 
        ? `<img src="${book.image}" alt="${book.title}" style="border: 2px solid #d4af37; border-radius: 5px;">` 
        : `<div style="width: 100%; max-width: 300px; aspect-ratio: 2/3; background-color: #333; border: 2px solid #d4af37; border-radius: 5px; display:flex; align-items:center; justify-content:center; color:#888;">No Image</div>`;

    const similarBooks = getSimilarBooks(book);
    let similarHTML = '';
    if (similarBooks.length > 0) {
        similarHTML = `
            <h3 style="color: #d4af37; margin-top: 50px; border-bottom: 1px solid #333; padding-bottom: 10px;">Similar Books</h3>
            <div class="similar-books-container">
                ${similarBooks.map(sb => `
                    <div class="similar-book-card" onclick="window.location.hash='book-${sb.id}'">
                        ${sb.image && sb.image !== "" ? `<img src="${sb.image}" alt="${sb.title}">` : `<div style="width: 120px; height: 180px; background-color: #333; border: 1px solid #444; display:flex; align-items:center; justify-content:center; color:#888; font-size:0.8rem;">No Image</div>`}
                        <div class="similar-book-title">${sb.title}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #d4af37; margin-bottom: 5px; font-size: 2.5rem;">${book.title}</h1>
            <h3 style="margin-top: 0; color: #ccc; font-size: 1.2rem;">by ${book.author}</h3>
        </div>

        <div style="display: flex; gap: 40px; flex-wrap: wrap; justify-content: center;">
            <div style="flex: 0 0 auto;">${imageHTML}</div>
            
            <div style="flex-grow: 1; max-width: 450px; display: flex; flex-direction: column; justify-content: center;">
                
                <div style="background: #1a1a1a; padding: 25px; border-radius: 8px; border-left: 4px solid #d4af37; margin-bottom: 20px;">
                    <h2 style="margin-top: 0; font-size: 1.2rem; color: #fff;">Overall Rating</h2>
                    <div style="font-size: 1.2rem;">
                        ${getStarsHTML(book.overallRating)}
                    </div>
                </div>

                <div style="background: #111; padding: 15px; border-radius: 8px; font-size: 0.95em;">
                    <p style="color: #ccc; margin-top: 0;"><strong>Read on:</strong> ${book.dateRead || 'Unknown'}</p>
                    <p style="color: #ccc; margin-bottom: 15px;"><strong>Word Count:</strong> ${book.numberOfWords || 'Unknown'}</p>

                    <p style="color: #888; margin-bottom: 0;"><strong>Tags:</strong> <br><br>${(book.tags || []).map(t => `<span style="background: #333; padding: 4px 10px; border-radius: 12px; margin-right: 6px; display: inline-block; margin-bottom: 6px; border: 1px solid #d4af37; color: #d4af37; font-size: 0.9em;">${t}</span>`).join('')}</p>
                </div>
            </div>
        </div>
        
        <hr style="border-color: #333; margin: 40px 0 20px 0;">
        <h3 style="color: #d4af37; font-size: 1.5rem;">Synopsis</h3>
        <p style="line-height: 1.8; white-space: pre-wrap; font-size: 1.1em; color: #ccc; max-width: 900px; margin: 0 auto 30px auto;">${book.synopsis || 'No synopsis available.'}</p>
        
        <h3 style="color: #d4af37; font-size: 1.5rem;">Review</h3>
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; max-width: 900px; margin: 0 auto;">
            <p style="line-height: 1.8; white-space: pre-wrap; font-size: 1.1em; color: #eee; margin: 0;">${book.review || 'No review available.'}</p>
        </div>

        ${similarHTML}
    `;
}

// --- UTILITIES & LISTENERS ---
function populateTags() {
    const tagsContainer = document.getElementById('tag-dropdown');
    const allTags = new Set();
    
    allBooks.forEach(book => {
        if (book.tags) book.tags.forEach(tag => allTags.add(tag));
    });
    
    Array.from(allTags).sort().forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tag-item';
        tagEl.textContent = tag;
        
        tagEl.onclick = () => {
            if (selectedTags.has(tag)) {
                selectedTags.delete(tag);
                tagEl.classList.remove('active-tag');
            } else {
                selectedTags.add(tag);
                tagEl.classList.add('active-tag');
            }
            applyFiltersAndSort();
        };
        tagsContainer.appendChild(tagEl);
    });
}

// NEW: Overhauled Pagination System
function updatePagination() {
    const totalPages = Math.ceil(filteredBooks.length / itemsPerPage) || 1;
    
    // Toggle standard Prev/Next buttons
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    const pageInfoContainer = document.getElementById('page-info');
    if (!pageInfoContainer) return;
    
    // Clear out the old "Page X of Y" text
    pageInfoContainer.innerHTML = ''; 
    pageInfoContainer.style.display = 'inline-flex';
    pageInfoContainer.style.gap = '8px';
    pageInfoContainer.style.alignItems = 'center';
    pageInfoContainer.style.margin = '0 15px';

    // Figure out which 3 adjacent pages to show
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, currentPage + 1);

    // Adjust boundaries to ensure we always show 3 buttons if possible
    if (currentPage === 1) {
        endPage = Math.min(totalPages, 3);
    } else if (currentPage === totalPages) {
        startPage = Math.max(1, totalPages - 2);
    }

    // Generate the adjacent numbered buttons
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'btn-gold'; 
        btn.style.padding = '5px 12px';
        btn.style.cursor = 'pointer';
        
        // Highlight logic for the current page
        if (i === currentPage) {
            btn.style.backgroundColor = '#d4af37';
            btn.style.color = '#111';
            btn.style.fontWeight = 'bold';
        }

        btn.onclick = () => {
            currentPage = i;
            renderBookList();
            window.scrollTo(0, 0);
        };
        pageInfoContainer.appendChild(btn);
    }

    // Add visual divider and "Last" button if we aren't near the end
    if (endPage < totalPages) {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        ellipsis.style.color = '#d4af37';
        pageInfoContainer.appendChild(ellipsis);

        const lastBtn = document.createElement('button');
        lastBtn.textContent = 'Last';
        lastBtn.className = 'btn-gold';
        lastBtn.style.padding = '5px 12px';
        lastBtn.style.cursor = 'pointer';
        
        lastBtn.onclick = () => {
            currentPage = totalPages;
            renderBookList();
            window.scrollTo(0, 0);
        };
        pageInfoContainer.appendChild(lastBtn);
    }
}

function updateFilterStars() {
    const percentage = calculateStarPercentage(currentQuery.maxRating);
    document.querySelector('.filter-stars-inner').style.width = `${percentage}%`;
}

function setupEventListeners() {
    document.getElementById('toggle-search-btn').addEventListener('click', (e) => {
        const searchContainer = document.getElementById('search-bar-container');
        if (searchContainer.style.display === 'none') {
            searchContainer.style.display = 'block';
            e.target.textContent = '▲ Close Search';
        } else {
            searchContainer.style.display = 'none';
            e.target.textContent = '🔍 Open Search';
        }
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        currentQuery.searchTerm = e.target.value;
        applyFiltersAndSort();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentQuery.sortBy = e.target.getAttribute('data-sort');
            applyFiltersAndSort();
        });
    });

    // LEQ Star Filter Listener - WITH DEAD SPACE FIX
    document.getElementById('rating-filter-stars').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        const gapRatio = 0.25; 
        const totalWidthUnits = 5 + (4 * gapRatio);
        const clickedUnits = (x / width) * totalWidthUnits;
        
        const starIndex = Math.floor(clickedUnits / (1 + gapRatio));
        const remainder = clickedUnits - (starIndex * (1 + gapRatio));
        
        let selectedStars;
        
        if (remainder > 1) {
            // Clicked firmly in the gap -> round down to the completed star on the left
            selectedStars = starIndex + 1; 
        } else if (remainder < 0.20) {
            // FIX: If you click the right half of the gap, the math thinks you've entered 
            // the first ~20% of the NEXT star's bounding box. Force it down to the left star.
            selectedStars = starIndex;
        } else {
            // Clicked firmly on the star itself; respect the fractional rating
            selectedStars = starIndex + remainder;
        }
        
        selectedStars = Math.min(Math.max(selectedStars, 0), 5);
        let finalRating = selectedStars * 2;
        currentQuery.maxRating = Math.round(finalRating * 10) / 10; 
        
        updateFilterStars();
        applyFiltersAndSort();
    });

    // These still work as normal, but now coordinate with our dynamic middle buttons
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderBookList();
            window.scrollTo(0, 0);
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderBookList();
            window.scrollTo(0, 0);
        }
    });
}