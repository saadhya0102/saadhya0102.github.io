'use strict';

const state = {
    books: [],
    savedJson: '',
    images: [],
    selectedBook: null,
    query: '',
    showValidation: false,
    touchedFields: new Set(),
    draggedBook: null,
    toastTimer: null
};

const elements = {
    workspace: document.getElementById('workspace'),
    bookPath: document.getElementById('bookPath'),
    saveState: document.getElementById('saveState'),
    reloadButton: document.getElementById('reloadButton'),
    saveButton: document.getElementById('saveButton'),
    errorBanner: document.getElementById('errorBanner'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    retryButton: document.getElementById('retryButton'),
    bookCount: document.getElementById('bookCount'),
    bookSearch: document.getElementById('bookSearch'),
    bookList: document.getElementById('bookList'),
    listEmpty: document.getElementById('listEmpty'),
    newBookButton: document.getElementById('newBookButton'),
    loadingPanel: document.getElementById('loadingPanel'),
    emptyPanel: document.getElementById('emptyPanel'),
    emptyNewButton: document.getElementById('emptyNewButton'),
    bookForm: document.getElementById('bookForm'),
    editorTitle: document.getElementById('editorTitle'),
    positionLabel: document.getElementById('positionLabel'),
    moveUpButton: document.getElementById('moveUpButton'),
    moveDownButton: document.getElementById('moveDownButton'),
    duplicateButton: document.getElementById('duplicateButton'),
    deleteButton: document.getElementById('deleteButton'),
    validationSummary: document.getElementById('validationSummary'),
    validationList: document.getElementById('validationList'),
    imagePreview: document.getElementById('imagePreview'),
    imagePlaceholder: document.getElementById('imagePlaceholder'),
    dropZone: document.getElementById('dropZone'),
    dropTitle: document.getElementById('dropTitle'),
    imageUpload: document.getElementById('imageUpload'),
    imageInput: document.getElementById('imageInput'),
    existingImageSelect: document.getElementById('existingImageSelect'),
    useExistingImageButton: document.getElementById('useExistingImageButton'),
    titleInput: document.getElementById('titleInput'),
    authorInput: document.getElementById('authorInput'),
    idInput: document.getElementById('idInput'),
    ratingInput: document.getElementById('ratingInput'),
    wordCountInput: document.getElementById('wordCountInput'),
    dateReadInput: document.getElementById('dateReadInput'),
    tagList: document.getElementById('tagList'),
    tagInput: document.getElementById('tagInput'),
    synopsisInput: document.getElementById('synopsisInput'),
    synopsisCount: document.getElementById('synopsisCount'),
    reviewInput: document.getElementById('reviewInput'),
    reviewCount: document.getElementById('reviewCount'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    toastAction: document.getElementById('toastAction')
};

const errorElements = {
    title: document.getElementById('titleError'),
    author: document.getElementById('authorError'),
    id: document.getElementById('idError'),
    image: document.getElementById('imageError'),
    overallRating: document.getElementById('ratingError'),
    numberOfWords: document.getElementById('wordCountError'),
    dateRead: document.getElementById('dateReadError'),
    tags: document.getElementById('tagsError'),
    synopsis: document.getElementById('synopsisError'),
    review: document.getElementById('reviewError')
};

const inputElements = {
    title: elements.titleInput,
    author: elements.authorInput,
    id: elements.idInput,
    image: elements.imageInput,
    overallRating: elements.ratingInput,
    numberOfWords: elements.wordCountInput,
    dateRead: elements.dateReadInput,
    synopsis: elements.synopsisInput,
    review: elements.reviewInput
};

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeBook(book) {
    const rating = Number(book.overallRating);
    const words = Number(book.numberOfWords);
    const normalized = {
        ...book,
        id: String(book.id ?? ''),
        title: String(book.title ?? ''),
        author: String(book.author ?? ''),
        image: String(book.image ?? ''),
        overallRating: Number.isFinite(rating) ? rating : null,
        tags: Array.isArray(book.tags) ? book.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
        numberOfWords: Number.isInteger(words) && words >= 0 ? words : null,
        synopsis: String(book.synopsis ?? ''),
        review: String(book.review ?? '')
    };

    if ('dateRead' in book) {
        if (book.dateRead) normalized.dateRead = String(book.dateRead);
        else delete normalized.dateRead;
    }
    return normalized;
}

function currentBook() {
    return state.selectedBook && state.books.includes(state.selectedBook)
        ? state.selectedBook
        : null;
}

function currentIndex() {
    return currentBook() ? state.books.indexOf(state.selectedBook) : -1;
}

function nextId() {
    const values = state.books
        .map(book => Number(book.id))
        .filter(Number.isInteger);
    return String((values.length ? Math.max(...values) : 0) + 1);
}

function isDirty() {
    return JSON.stringify(state.books) !== state.savedJson;
}

function updateSaveState() {
    if (!state.savedJson) {
        elements.saveState.textContent = 'Loading books';
        elements.saveState.dataset.state = '';
        elements.saveButton.disabled = true;
        return;
    }

    const dirty = isDirty();
    elements.saveState.textContent = dirty ? 'Unsaved changes' : 'Saved';
    elements.saveState.dataset.state = dirty ? 'dirty' : 'saved';
    elements.saveButton.disabled = !dirty;
}

function markChanged({ list = false, validation = true } = {}) {
    updateSaveState();
    if (list) renderBookList();
    if (validation && (state.showValidation || state.touchedFields.size > 0)) {
        renderValidation();
    }
}

function showError(title, message) {
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    elements.errorBanner.hidden = false;
    elements.saveState.textContent = 'Editor unavailable';
    elements.saveState.dataset.state = 'error';
}

function hideError() {
    elements.errorBanner.hidden = true;
}

function showToast(message, actionLabel = '', action = null, timeout = 5000) {
    clearTimeout(state.toastTimer);
    elements.toastMessage.textContent = message;
    elements.toastAction.hidden = !actionLabel || !action;
    elements.toastAction.textContent = actionLabel;
    elements.toastAction.onclick = null;

    if (actionLabel && action) {
        elements.toastAction.onclick = () => {
            action();
            hideToast();
        };
    }

    elements.toast.hidden = false;
    state.toastTimer = setTimeout(hideToast, timeout);
}

function hideToast() {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
    elements.toast.hidden = true;
    elements.toastAction.onclick = null;
}

function localImageFilename(image) {
    const value = String(image || '').trim();
    if (!value || /^(https?:\/\/|data:)/i.test(value)) return '';
    let filename = value.replace(/\\/g, '/').split('/').pop();
    if (/\.jpeg$/i.test(filename)) filename = filename.replace(/\.jpeg$/i, '.jpg');
    return filename;
}

function imageUrl(image) {
    const value = String(image || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|data:)/i.test(value)) return value;
    const filename = localImageFilename(value);
    return `/images/${encodeURIComponent(filename)}`;
}

function localImageAvailable(image) {
    const filename = localImageFilename(image);
    return !filename || state.images.includes(filename);
}

function setBookThumbnail(container, book) {
    const url = imageUrl(book.image);
    container.replaceChildren();
    if (!url) {
        container.textContent = 'No cover';
        return;
    }
    if (!localImageAvailable(book.image)) {
        container.textContent = 'Missing';
        return;
    }

    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
        container.replaceChildren();
        container.textContent = 'Missing';
    });
    container.appendChild(image);
}

function renderBookList() {
    const query = state.query.trim().toLowerCase();
    const books = state.books.filter(book => {
        if (!query) return true;
        const haystack = [
            book.title,
            book.author,
            book.id,
            ...(book.tags || [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });

    elements.bookCount.textContent = query
        ? `${books.length} of ${state.books.length} books`
        : `${state.books.length} ${state.books.length === 1 ? 'book' : 'books'}`;
    elements.bookList.replaceChildren();
    elements.listEmpty.hidden = books.length > 0;

    books.forEach(book => {
        const item = document.createElement('li');
        item.className = 'project-list-item';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'project-item';
        button.draggable = true;
        button.setAttribute('aria-current', book === currentBook() ? 'true' : 'false');

        const thumbnail = document.createElement('span');
        thumbnail.className = 'project-thumb';
        setBookThumbnail(thumbnail, book);

        const copy = document.createElement('span');
        copy.className = 'project-copy';
        const title = document.createElement('strong');
        title.textContent = book.title || 'Untitled book';
        const author = document.createElement('span');
        author.textContent = book.author ? `by ${book.author}` : 'No author';
        const rating = document.createElement('span');
        rating.className = 'project-rating';
        rating.textContent = Number.isFinite(book.overallRating)
            ? `${book.overallRating.toFixed(1)} / 10`
            : 'No rating';
        copy.append(title, author, rating);

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '••';
        handle.setAttribute('aria-hidden', 'true');

        button.append(thumbnail, copy, handle);
        button.addEventListener('click', () => selectBook(book));
        button.addEventListener('dragstart', event => {
            state.draggedBook = book;
            button.classList.add('is-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', book.id || book.title || 'book');
        });
        button.addEventListener('dragend', () => {
            state.draggedBook = null;
            button.classList.remove('is-dragging');
        });
        button.addEventListener('dragover', event => {
            if (state.draggedBook && state.draggedBook !== book && !query) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            }
        });
        button.addEventListener('drop', event => {
            event.preventDefault();
            if (!state.draggedBook || state.draggedBook === book || query) return;
            reorderBook(state.draggedBook, book);
        });

        item.appendChild(button);
        elements.bookList.appendChild(item);
    });
}

function selectBook(book) {
    if (!state.books.includes(book)) return;
    state.selectedBook = book;
    state.showValidation = false;
    state.touchedFields.clear();
    renderBookList();
    renderEditor();
}

function renderImageOptions() {
    const selected = elements.existingImageSelect.value;
    elements.existingImageSelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a cover';
    elements.existingImageSelect.appendChild(placeholder);

    state.images.forEach(filename => {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        elements.existingImageSelect.appendChild(option);
    });

    if (state.images.includes(selected)) elements.existingImageSelect.value = selected;
}

function renderImagePreview() {
    const book = currentBook();
    const url = book ? imageUrl(book.image) : '';
    elements.imagePreview.hidden = true;
    elements.imagePlaceholder.hidden = false;
    elements.imagePlaceholder.textContent = url ? 'Loading cover' : 'No cover selected';

    if (!url) return;
    if (!localImageAvailable(book.image)) {
        elements.imagePlaceholder.textContent = 'Cover file is not in books_images';
        return;
    }

    elements.imagePreview.onload = () => {
        elements.imagePreview.hidden = false;
        elements.imagePlaceholder.hidden = true;
    };
    elements.imagePreview.onerror = () => {
        elements.imagePreview.hidden = true;
        elements.imagePlaceholder.hidden = false;
        elements.imagePlaceholder.textContent = 'Cover could not be loaded';
    };
    elements.imagePreview.alt = book.title
        ? `Cover preview for ${book.title}`
        : 'Book cover preview';
    elements.imagePreview.src = url;
}

function renderTags() {
    const book = currentBook();
    elements.tagList.replaceChildren();
    if (!book) return;

    (book.tags || []).forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Delete tag ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
            book.tags.splice(index, 1);
            state.touchedFields.add('tags');
            renderTags();
            markChanged({ list: true });
        });
        chip.append(text, remove);
        elements.tagList.appendChild(chip);
    });
}

function renderEditor() {
    const book = currentBook();
    elements.loadingPanel.hidden = true;
    elements.bookForm.hidden = !book;
    elements.emptyPanel.hidden = Boolean(book);

    if (!book) {
        renderValidation();
        return;
    }

    const index = currentIndex();
    elements.positionLabel.textContent = `Book ${index + 1} of ${state.books.length}`;
    elements.editorTitle.textContent = book.title || 'Untitled book';
    elements.moveUpButton.disabled = index <= 0;
    elements.moveDownButton.disabled = index < 0 || index >= state.books.length - 1;

    elements.titleInput.value = book.title || '';
    elements.authorInput.value = book.author || '';
    elements.idInput.value = book.id || '';
    elements.imageInput.value = book.image || '';
    elements.ratingInput.value = book.overallRating ?? '';
    elements.wordCountInput.value = book.numberOfWords ?? '';
    elements.dateReadInput.value = book.dateRead || '';
    elements.synopsisInput.value = book.synopsis || '';
    elements.reviewInput.value = book.review || '';
    elements.synopsisCount.textContent = `${elements.synopsisInput.value.length} characters`;
    elements.reviewCount.textContent = `${elements.reviewInput.value.length} characters`;

    renderImageOptions();
    renderImagePreview();
    renderTags();
    renderValidation();
}

function renderAll() {
    renderBookList();
    renderEditor();
    updateSaveState();
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateBooks() {
    const errors = [];
    const add = (bookIndex, field, message) => errors.push({ bookIndex, field, message });
    const ids = new Set();

    state.books.forEach((book, bookIndex) => {
        const id = String(book.id || '');
        if (!id) {
            add(bookIndex, 'id', 'Please enter an ID.');
        } else if (!/^\d+$/.test(id)) {
            add(bookIndex, 'id', 'Use numbers only.');
        } else if (ids.has(id)) {
            add(bookIndex, 'id', `The ID "${id}" is already in use.`);
        }
        ids.add(id);

        if (!String(book.title || '').trim()) {
            add(bookIndex, 'title', 'Please enter a title.');
        }
        if (!String(book.author || '').trim()) {
            add(bookIndex, 'author', 'Please enter an author.');
        }
        if (typeof book.image !== 'string') {
            add(bookIndex, 'image', 'Enter a cover filename or URL.');
        }
        if (typeof book.overallRating !== 'number' || !Number.isFinite(book.overallRating) || book.overallRating < 0 || book.overallRating > 10) {
            add(bookIndex, 'overallRating', 'Enter a rating from 0 through 10.');
        }
        if (!Number.isInteger(book.numberOfWords) || book.numberOfWords < 0) {
            add(bookIndex, 'numberOfWords', 'Enter a whole word count of 0 or more.');
        }
        if (book.dateRead && !validDate(book.dateRead)) {
            add(bookIndex, 'dateRead', 'Enter a date using YYYY-MM-DD.');
        }

        const tags = Array.isArray(book.tags) ? book.tags : [];
        const seenTags = new Set();
        tags.forEach(tag => {
            const clean = String(tag || '').trim();
            if (!clean) {
                add(bookIndex, 'tags', 'Tags cannot be empty.');
            } else if (seenTags.has(clean.toLowerCase())) {
                add(bookIndex, 'tags', `Tag "${clean}" is listed more than once.`);
            }
            seenTags.add(clean.toLowerCase());
        });

        if (typeof book.synopsis !== 'string') {
            add(bookIndex, 'synopsis', 'Synopsis must be text.');
        }
        if (typeof book.review !== 'string') {
            add(bookIndex, 'review', 'Review must be text.');
        }
    });

    return errors;
}

function clearValidationFields() {
    Object.values(errorElements).forEach(element => {
        element.textContent = '';
    });
    Object.values(inputElements).forEach(element => {
        element.removeAttribute('aria-invalid');
        element.removeAttribute('aria-describedby');
    });
}

function renderValidation() {
    clearValidationFields();
    const errors = validateBooks();
    const bookIndex = currentIndex();
    const currentErrors = errors.filter(error => error.bookIndex === bookIndex);

    currentErrors.forEach(error => {
        const shouldShow = state.showValidation || state.touchedFields.has(error.field);
        if (!shouldShow) return;
        const errorElement = errorElements[error.field];
        if (errorElement && !errorElement.textContent) {
            errorElement.textContent = error.message;
        }
        const input = inputElements[error.field];
        if (input) {
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', errorElement.id);
        }
    });

    elements.validationSummary.hidden = !state.showValidation || errors.length === 0;
    elements.validationList.replaceChildren();

    if (state.showValidation && errors.length > 0) {
        errors.slice(0, 10).forEach(error => {
            const item = document.createElement('li');
            const book = state.books[error.bookIndex];
            item.textContent = `${book?.title || 'Untitled book'}: ${error.message}`;
            elements.validationList.appendChild(item);
        });
        if (errors.length > 10) {
            const item = document.createElement('li');
            item.textContent = `${errors.length - 10} more issues`;
            elements.validationList.appendChild(item);
        }
    }
}

function focusValidationError(error) {
    if (!error) return;
    const book = state.books[error.bookIndex];
    if (book) state.selectedBook = book;
    renderAll();

    requestAnimationFrame(() => {
        elements.validationSummary.focus();
        const target = inputElements[error.field];
        if (target) target.focus();
    });
}

async function loadState({ confirmDiscard = false } = {}) {
    if (confirmDiscard && isDirty() && !window.confirm('Reload books.json and discard unsaved changes?')) {
        return;
    }

    hideError();
    elements.workspace.setAttribute('aria-busy', 'true');
    elements.loadingPanel.hidden = false;
    elements.bookForm.hidden = true;
    elements.emptyPanel.hidden = true;
    elements.reloadButton.disabled = true;
    elements.saveButton.disabled = true;
    elements.saveState.textContent = 'Loading books';
    elements.saveState.dataset.state = '';

    try {
        const response = await fetch('/api/state');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'The editor could not read books.json.');
        if (!Array.isArray(payload.data)) throw new Error('books.json must contain an array.');

        state.books = payload.data.map(normalizeBook);
        state.images = payload.images || [];
        state.savedJson = JSON.stringify(state.books);
        state.selectedBook = state.books[0] || null;
        state.query = '';
        state.showValidation = false;
        state.touchedFields.clear();

        elements.bookPath.textContent = payload.paths?.books || 'books.json';
        elements.bookSearch.value = '';
        renderAll();
    } catch (error) {
        elements.loadingPanel.hidden = true;
        elements.emptyPanel.hidden = false;
        showError('Could not load books.', `${error.message} Start the editor again if the server window was closed.`);
    } finally {
        elements.workspace.setAttribute('aria-busy', 'false');
        elements.reloadButton.disabled = false;
    }
}

async function saveBooks() {
    if (!isDirty()) return;

    state.showValidation = true;
    const errors = validateBooks();
    if (errors.length > 0) {
        focusValidationError(errors[0]);
        showToast(`Fix ${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} before saving.`);
        return;
    }

    elements.saveButton.disabled = true;
    elements.reloadButton.disabled = true;
    elements.saveButton.textContent = 'Saving';
    elements.saveState.textContent = 'Saving books.json';
    elements.saveState.dataset.state = '';

    try {
        const response = await fetch('/api/books', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.books)
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.errors?.[0]?.message || payload.message || 'books.json was not saved.');
        }

        state.savedJson = JSON.stringify(state.books);
        state.showValidation = false;
        state.touchedFields.clear();
        renderValidation();
        updateSaveState();
        showToast(payload.changed
            ? `Saved books.json. Backup: ${payload.backup}`
            : 'books.json already matches these changes.');
    } catch (error) {
        elements.saveState.textContent = 'Save failed';
        elements.saveState.dataset.state = 'error';
        showToast(`${error.message} Your edits are still open.`);
    } finally {
        elements.saveButton.textContent = 'Save changes';
        elements.reloadButton.disabled = false;
        updateSaveState();
    }
}

function createBook() {
    const book = {
        id: nextId(),
        title: 'New book',
        author: '',
        image: '',
        overallRating: 0,
        tags: [],
        numberOfWords: 0,
        synopsis: '',
        review: ''
    };

    state.books.push(book);
    state.selectedBook = book;
    state.showValidation = false;
    state.touchedFields.clear();
    state.query = '';
    elements.bookSearch.value = '';
    renderAll();
    requestAnimationFrame(() => elements.titleInput.select());
}

function duplicateBook() {
    const book = currentBook();
    if (!book) return;
    const copy = deepClone(book);
    copy.id = nextId();
    copy.title = `${book.title || 'Untitled book'} copy`;

    const insertAt = currentIndex() + 1;
    state.books.splice(insertAt, 0, copy);
    state.selectedBook = copy;
    state.showValidation = false;
    state.touchedFields.clear();
    renderAll();
    showToast(`Duplicated ${book.title || 'book'}.`);
}

function deleteBook() {
    const book = currentBook();
    if (!book) return;

    const index = currentIndex();
    state.books.splice(index, 1);
    state.selectedBook = state.books[index] || state.books[index - 1] || null;
    state.showValidation = false;
    state.touchedFields.clear();
    renderAll();

    showToast(`Deleted ${book.title || 'book'}. Save changes to write the file.`, 'Undo', () => {
        state.books.splice(index, 0, book);
        state.selectedBook = book;
        renderAll();
    }, 8000);
}

function moveBook(delta) {
    const book = currentBook();
    const from = currentIndex();
    const to = from + delta;
    if (!book || to < 0 || to >= state.books.length) return;
    state.books.splice(from, 1);
    state.books.splice(to, 0, book);
    renderAll();
}

function reorderBook(source, target) {
    const from = state.books.indexOf(source);
    let to = state.books.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    state.books.splice(from, 1);
    if (from < to) to -= 1;
    state.books.splice(to, 0, source);
    renderAll();
}

function addTags(rawValue) {
    const book = currentBook();
    if (!book) return;

    const additions = String(rawValue || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    if (!additions.length) return;

    book.tags = Array.isArray(book.tags) ? book.tags : [];
    const existing = new Set(book.tags.map(tag => tag.toLowerCase()));
    additions.forEach(tag => {
        if (!existing.has(tag.toLowerCase())) {
            book.tags.push(tag);
            existing.add(tag.toLowerCase());
        }
    });

    elements.tagInput.value = '';
    state.touchedFields.add('tags');
    renderTags();
    markChanged({ list: true });
}

async function uploadImage(file) {
    if (!file) return;
    const book = currentBook();
    if (!book) {
        showToast('Select a book before adding a cover.');
        return;
    }

    elements.dropZone.classList.add('is-uploading');
    elements.dropTitle.textContent = `Adding ${file.name}`;
    elements.imageUpload.disabled = true;

    try {
        const response = await fetch(`/api/images?filename=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'The cover was not added.');

        if (!state.images.includes(payload.filename)) {
            state.images.push(payload.filename);
            state.images.sort((a, b) => a.localeCompare(b));
        }
        book.image = payload.filename;
        elements.imageInput.value = payload.filename;
        renderImageOptions();
        renderImagePreview();
        markChanged({ list: true });
        showToast(`Added ${payload.filename}.`);
    } catch (error) {
        showToast(`${error.message} Choose a different cover and try again.`);
    } finally {
        elements.dropZone.classList.remove('is-uploading');
        elements.dropTitle.textContent = 'Drop a cover here';
        elements.imageUpload.disabled = false;
        elements.imageUpload.value = '';
    }
}

function bindStaticEvents() {
    elements.retryButton.addEventListener('click', () => loadState());
    elements.reloadButton.addEventListener('click', () => loadState({ confirmDiscard: true }));
    elements.saveButton.addEventListener('click', saveBooks);
    elements.newBookButton.addEventListener('click', createBook);
    elements.emptyNewButton.addEventListener('click', createBook);

    elements.bookSearch.addEventListener('input', () => {
        state.query = elements.bookSearch.value;
        renderBookList();
    });

    elements.moveUpButton.addEventListener('click', () => moveBook(-1));
    elements.moveDownButton.addEventListener('click', () => moveBook(1));
    elements.duplicateButton.addEventListener('click', duplicateBook);
    elements.deleteButton.addEventListener('click', deleteBook);

    elements.titleInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.title = elements.titleInput.value;
        elements.editorTitle.textContent = book.title || 'Untitled book';
        markChanged({ list: true });
    });

    elements.authorInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.author = elements.authorInput.value;
        markChanged({ list: true });
    });

    elements.idInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.id = elements.idInput.value;
        markChanged({ list: true });
    });

    elements.imageInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.image = elements.imageInput.value;
        markChanged({ list: true });
    });
    elements.imageInput.addEventListener('change', renderImagePreview);

    elements.ratingInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.overallRating = elements.ratingInput.value === '' ? null : Number(elements.ratingInput.value);
        markChanged({ list: true });
    });

    elements.wordCountInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.numberOfWords = elements.wordCountInput.value === '' ? null : Number(elements.wordCountInput.value);
        markChanged();
    });

    elements.dateReadInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        if (elements.dateReadInput.value) book.dateRead = elements.dateReadInput.value;
        else delete book.dateRead;
        markChanged();
    });

    elements.synopsisInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.synopsis = elements.synopsisInput.value;
        elements.synopsisCount.textContent = `${elements.synopsisInput.value.length} characters`;
        markChanged();
    });

    elements.reviewInput.addEventListener('input', () => {
        const book = currentBook();
        if (!book) return;
        book.review = elements.reviewInput.value;
        elements.reviewCount.textContent = `${elements.reviewInput.value.length} characters`;
        markChanged();
    });

    elements.bookForm.addEventListener('focusout', event => {
        const field = event.target.name;
        if (field && errorElements[field]) {
            state.touchedFields.add(field);
            renderValidation();
        }
    });

    elements.bookForm.addEventListener('submit', event => {
        event.preventDefault();
        saveBooks();
    });

    elements.tagInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTags(elements.tagInput.value);
        } else if (event.key === 'Backspace' && !elements.tagInput.value) {
            const book = currentBook();
            if (book?.tags?.length) {
                book.tags.pop();
                renderTags();
                markChanged({ list: true });
            }
        }
    });
    elements.tagInput.addEventListener('blur', () => addTags(elements.tagInput.value));

    elements.imageUpload.addEventListener('change', () => {
        uploadImage(elements.imageUpload.files[0]);
    });

    ['dragenter', 'dragover'].forEach(type => {
        elements.dropZone.addEventListener(type, event => {
            event.preventDefault();
            elements.dropZone.classList.add('is-dragover');
        });
    });
    ['dragleave', 'drop'].forEach(type => {
        elements.dropZone.addEventListener(type, event => {
            event.preventDefault();
            elements.dropZone.classList.remove('is-dragover');
        });
    });
    elements.dropZone.addEventListener('drop', event => {
        uploadImage(event.dataTransfer.files[0]);
    });

    elements.useExistingImageButton.addEventListener('click', () => {
        const book = currentBook();
        const image = elements.existingImageSelect.value;
        if (!book || !image) {
            showToast('Choose an existing cover first.');
            return;
        }
        book.image = image;
        elements.imageInput.value = image;
        renderImagePreview();
        markChanged({ list: true });
    });

    document.addEventListener('keydown', event => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() === 's') {
            event.preventDefault();
            saveBooks();
        }
        if (event.key.toLowerCase() === 'n') {
            event.preventDefault();
            createBook();
        }
    });

    window.addEventListener('beforeunload', event => {
        if (!isDirty()) return;
        event.preventDefault();
        event.returnValue = '';
    });
}

bindStaticEvents();
loadState();
