// --- STATE MANAGEMENT ---
let allBooks = [];
let filteredBooks = [];
let currentPage = 1;
const itemsPerPage = 10;

let selectedTags = new Set();

let currentQuery = {
    searchTerm: '',
    sortBy: 'rank' // Default to ranking
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('books.json');
        allBooks = await response.json();
        
        populateTags();
        applyFiltersAndSort();
        setupEventListeners();
        
        // Listen for back/forward buttons and initial load
        window.addEventListener('hashchange', handleRouting);
        handleRouting(); // trigger on load
    } catch (error) {
        console.error("Error loading the library:", error);
        document.getElementById('book-list-container').innerHTML = '<p>Could not load books. Check console.</p>';
    }
});

// --- ROUTING ENGINE ---
function handleRouting() {
    const hash = window.location.hash;
    
    // Hide everything first
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
        // Default list view
        document.getElementById('search-view').style.display = 'block';
        document.getElementById('list-view').style.display = 'block';
    }
}


// --- HELPER FUNCTIONS ---
function getStarsHTML(ratingOutOf10) {
    const percentage = (ratingOutOf10 / 10) * 100;
    return `
    <div class="stars-outer" title="${ratingOutOf10}/10">
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

// SIMILARITY ENGINE
function getSimilarBooks(targetBook) {
    return allBooks
        .filter(b => b.id !== targetBook.id)
        .map(b => {
            // Heavy emphasis on tag overlap (10 points per shared tag)
            const overlapCount = b.tags.filter(t => targetBook.tags.includes(t)).length;
            
            // Low-medium emphasis on rating difference (-2 points per rating gap)
            const ratingDiff = Math.abs(b.overallRating - targetBook.overallRating);
            
            const score = (overlapCount * 10) - (ratingDiff * 2);
            return { book: b, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 7) // Top 7
        .map(item => item.book);
}

// --- CORE FILTER & SORT ---
function applyFiltersAndSort() {
    filteredBooks = allBooks.filter(book => {
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
    } else if (currentQuery.sortBy === 'rank') {
        filteredBooks.sort((a, b) => a.rank - b.rank); // Sort 1, 2, 3...
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
            ? `<img src="${book.image}" alt="${book.title}" style="max-width: 120px; object-fit: cover; border-radius: 4px;">` 
            : `<div style="width: 120px; min-height: 180px; background-color: #333; border: 1px solid #444; display:flex; align-items:center; justify-content:center; color:#888; text-align:center; font-size:0.8rem;">No Image</div>`;

        // Snippet pulled from synopsis
        let snippet = book.synopsis.split('. ')[0];
        if (book.synopsis.includes('. ')) snippet += '.';
        if (snippet.length > 120) snippet = snippet.substring(0, 120) + '...';

        const card = document.createElement('div');
        card.className = 'book-card';
        card.style.cssText = "background: #1a1a1a; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #d4af37;";
        
        card.innerHTML = `
            <div style="display: flex; gap: 20px;">
                ${imageHTML}
                <div style="flex-grow: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <h2 style="margin: 0; color: #d4af37;">#${book.rank} - ${book.title}</h2>
                            <p style="margin: 5px 0 10px 0; color: #ccc;"><em>by ${book.author}</em></p>
                        </div>
                        <div style="max-width: 45%; color: #888; font-size: 0.9em; font-style: italic; text-align: right;">
                            "${snippet}"
                        </div>
                    </div>
                    
                    <div class="subratings-box" style="margin-top: auto; padding-top: 10px;">
                        <div style="margin-bottom: 5px;"><strong>${getStarsHTML(book.overallRating)}</strong> <span style="font-size: 0.8em; color: #aaa;">(${book.overallRating}/10)</span></div>
                    </div>
                    
                    <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div>
                            <p style="font-size: 0.85em; color: #aaa; margin: 0 0 5px 0;"><strong>Tags:</strong> ${book.tags.join(', ')}</p>
                            <span style="font-size: 0.8em; color: #666;">Read: ${book.dateRead}</span>
                        </div>
                        <button class="btn-gold more-info-btn" onclick="window.location.hash='book-${book.id}'">More Info</button>
                    </div>
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

    // View toggling is handled by handleRouting() now
    document.getElementById('detail-view').style.display = 'block';

    const container = document.getElementById('single-book-container');
    const imageHTML = book.image && book.image !== "" 
        ? `<img src="${book.image}" alt="${book.title}" style="width: 100%; max-width: 300px; border: 2px solid #d4af37; border-radius: 5px;">` 
        : `<div style="width: 300px; height: 450px; background-color: #333; border: 2px solid #d4af37; border-radius: 5px; display:flex; align-items:center; justify-content:center; color:#888;">No Image</div>`;

    // Fetch Similar Books
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
            <h1 style="color: #d4af37; margin-bottom: 5px; font-size: 2.5rem;">#${book.rank} - ${book.title}</h1>
            <h3 style="margin-top: 0; color: #ccc; font-size: 1.2rem;">by ${book.author}</h3>
        </div>

        <div style="display: flex; gap: 40px; flex-wrap: wrap; justify-content: center;">
            <div style="flex: 0 0 auto;">${imageHTML}</div>
            
            <div style="flex-grow: 1; max-width: 450px; display: flex; flex-direction: column; justify-content: center;">
                <div style="background: #1a1a1a; padding: 25px; border-radius: 8px; border-left: 4px solid #d4af37; margin-bottom: 20px;">
                    <h2 style="margin-top: 0; font-size: 1.2rem; color: #fff;">Overall Rating</h2>
                    <div style="margin-bottom: 15px; font-size: 1.2rem;">
                        ${getStarsHTML(book.overallRating)} <span style="font-size: 0.9em; color: #aaa; margin-left: 10px;">(${book.overallRating}/10)</span>
                    </div>
                </div>

                <div style="background: #111; padding: 15px; border-radius: 8px;">
                    <p style="color: #888; margin-top: 0;"><strong>Read on:</strong> ${book.dateRead}</p>
                    <p style="color: #888; margin-bottom: 0;"><strong>Tags:</strong> <br><br>${book.tags.map(t => `<span style="background: #333; padding: 4px 10px; border-radius: 12px; margin-right: 6px; border: 1px solid #d4af37; color: #d4af37; font-size: 0.9em;">${t}</span>`).join('')}</p>
                </div>
            </div>
        </div>
        
        <hr style="border-color: #333; margin: 40px 0 20px 0;">
        <h3 style="color: #d4af37; font-size: 1.5rem;">Synopsis</h3>
        <p style="line-height: 1.8; white-space: pre-wrap; font-size: 1.1em; color: #ccc; max-width: 900px; margin: 0 auto 30px auto;">${book.synopsis}</p>
        
        <h3 style="color: #d4af37; font-size: 1.5rem;">Review</h3>
        <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; max-width: 900px; margin: 0 auto;">
            <p style="line-height: 1.8; white-space: pre-wrap; font-size: 1.1em; color: #eee; margin: 0;">${book.review}</p>
        </div>

        ${similarHTML}
    `;
}

// --- UTILITIES & LISTENERS ---
function populateTags() {
    const tagsContainer = document.getElementById('tag-dropdown');
    const allTags = new Set();
    
    allBooks.forEach(book => book.tags.forEach(tag => allTags.add(tag)));
    
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

function updatePagination() {
    const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages || 1}`;
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages || totalPages === 0;
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