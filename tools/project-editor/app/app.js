'use strict';

const state = {
    data: { categoryOrder: [], projects: [] },
    savedJson: '',
    images: [],
    selectedProject: null,
    query: '',
    idAuto: false,
    showValidation: false,
    touchedFields: new Set(),
    draggedProject: null,
    categoryDraft: [],
    toastTimer: null
};

const elements = {
    workspace: document.getElementById('workspace'),
    projectPath: document.getElementById('projectPath'),
    saveState: document.getElementById('saveState'),
    reloadButton: document.getElementById('reloadButton'),
    saveButton: document.getElementById('saveButton'),
    errorBanner: document.getElementById('errorBanner'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    retryButton: document.getElementById('retryButton'),
    projectCount: document.getElementById('projectCount'),
    projectSearch: document.getElementById('projectSearch'),
    projectList: document.getElementById('projectList'),
    listEmpty: document.getElementById('listEmpty'),
    newProjectButton: document.getElementById('newProjectButton'),
    loadingPanel: document.getElementById('loadingPanel'),
    emptyPanel: document.getElementById('emptyPanel'),
    emptyNewButton: document.getElementById('emptyNewButton'),
    projectForm: document.getElementById('projectForm'),
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
    idInput: document.getElementById('idInput'),
    yearInput: document.getElementById('yearInput'),
    matchInput: document.getElementById('matchInput'),
    featuredInput: document.getElementById('featuredInput'),
    categoryChoices: document.getElementById('categoryChoices'),
    editCategoriesButton: document.getElementById('editCategoriesButton'),
    tagList: document.getElementById('tagList'),
    tagInput: document.getElementById('tagInput'),
    synopsisInput: document.getElementById('synopsisInput'),
    synopsisCount: document.getElementById('synopsisCount'),
    linkList: document.getElementById('linkList'),
    linksEmpty: document.getElementById('linksEmpty'),
    addLinkButton: document.getElementById('addLinkButton'),
    categoryDialog: document.getElementById('categoryDialog'),
    categoryForm: document.getElementById('categoryForm'),
    categoryList: document.getElementById('categoryList'),
    categoryDialogError: document.getElementById('categoryDialogError'),
    closeCategoryButton: document.getElementById('closeCategoryButton'),
    cancelCategoryButton: document.getElementById('cancelCategoryButton'),
    addCategoryButton: document.getElementById('addCategoryButton'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    toastAction: document.getElementById('toastAction')
};

const errorElements = {
    title: document.getElementById('titleError'),
    id: document.getElementById('idError'),
    image: document.getElementById('imageError'),
    year: document.getElementById('yearError'),
    match: document.getElementById('matchError'),
    categories: document.getElementById('categoriesError'),
    tags: document.getElementById('tagsError'),
    synopsis: document.getElementById('synopsisError'),
    links: document.getElementById('linksError')
};

const inputElements = {
    title: elements.titleInput,
    id: elements.idInput,
    image: elements.imageInput,
    year: elements.yearInput,
    match: elements.matchInput,
    synopsis: elements.synopsisInput
};

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function currentProject() {
    return state.selectedProject && state.data.projects.includes(state.selectedProject)
        ? state.selectedProject
        : null;
}

function currentIndex() {
    return currentProject() ? state.data.projects.indexOf(state.selectedProject) : -1;
}

function slugify(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function uniqueId(base, ignoredProject = null) {
    const root = slugify(base) || 'new-project';
    const used = new Set(
        state.data.projects
            .filter(project => project !== ignoredProject)
            .map(project => project.id)
    );
    if (!used.has(root)) return root;
    let suffix = 2;
    while (used.has(`${root}-${suffix}`)) suffix += 1;
    return `${root}-${suffix}`;
}

function isDirty() {
    return JSON.stringify(state.data) !== state.savedJson;
}

function updateSaveState() {
    if (!state.savedJson) {
        elements.saveState.textContent = 'Loading projects';
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
    if (list) renderProjectList();
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

function imageUrl(image) {
    const value = String(image || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|data:)/i.test(value)) return value;
    const filename = value.replace(/\\/g, '/').split('/').pop();
    return `/images/${encodeURIComponent(filename)}`;
}

function projectMeta(project) {
    const categories = (project.categories || []).filter(category => category !== 'Featured');
    const parts = [];
    if (categories.length) parts.push(categories.join(', '));
    if (project.year) parts.push(String(project.year));
    return parts.join(' · ') || 'No category';
}

function setProjectThumbnail(container, project) {
    const url = imageUrl(project.image);
    container.replaceChildren();
    if (!url) {
        container.textContent = 'No image';
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

function renderProjectList() {
    const query = state.query.trim().toLowerCase();
    const projects = state.data.projects.filter(project => {
        if (!query) return true;
        const haystack = [
            project.title,
            project.id,
            ...(project.categories || []),
            ...(project.tags || [])
        ].join(' ').toLowerCase();
        return haystack.includes(query);
    });

    elements.projectCount.textContent = query
        ? `${projects.length} of ${state.data.projects.length} projects`
        : `${state.data.projects.length} ${state.data.projects.length === 1 ? 'project' : 'projects'}`;
    elements.projectList.replaceChildren();
    elements.listEmpty.hidden = projects.length > 0;

    projects.forEach(project => {
        const item = document.createElement('li');
        item.className = 'project-list-item';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'project-item';
        button.draggable = true;
        button.setAttribute('aria-current', project === currentProject() ? 'true' : 'false');

        const thumbnail = document.createElement('span');
        thumbnail.className = 'project-thumb';
        setProjectThumbnail(thumbnail, project);

        const copy = document.createElement('span');
        copy.className = 'project-copy';
        const title = document.createElement('strong');
        title.textContent = project.title || 'Untitled project';
        const meta = document.createElement('span');
        meta.textContent = projectMeta(project);
        copy.append(title, meta);

        const end = document.createElement('span');
        if (project.featured) {
            end.className = 'featured-mark';
            end.title = 'Featured project';
            end.setAttribute('aria-label', 'Featured project');
        } else {
            end.className = 'drag-handle';
            end.textContent = '••';
            end.setAttribute('aria-hidden', 'true');
        }

        button.append(thumbnail, copy, end);
        button.addEventListener('click', () => selectProject(project));
        button.addEventListener('dragstart', event => {
            state.draggedProject = project;
            button.classList.add('is-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', project.id || project.title || 'project');
        });
        button.addEventListener('dragend', () => {
            state.draggedProject = null;
            button.classList.remove('is-dragging');
        });
        button.addEventListener('dragover', event => {
            if (state.draggedProject && state.draggedProject !== project && !query) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            }
        });
        button.addEventListener('drop', event => {
            event.preventDefault();
            if (!state.draggedProject || state.draggedProject === project || query) return;
            reorderProject(state.draggedProject, project);
        });

        item.appendChild(button);
        elements.projectList.appendChild(item);
    });
}

function selectProject(project) {
    if (!state.data.projects.includes(project)) return;
    state.selectedProject = project;
    state.idAuto = false;
    state.showValidation = false;
    state.touchedFields.clear();
    renderProjectList();
    renderEditor();
}

function renderImageOptions() {
    const selected = elements.existingImageSelect.value;
    elements.existingImageSelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose an image';
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
    const project = currentProject();
    const url = project ? imageUrl(project.image) : '';
    elements.imagePreview.hidden = true;
    elements.imagePlaceholder.hidden = false;
    elements.imagePlaceholder.textContent = url ? 'Loading image' : 'No image selected';

    if (!url) return;

    elements.imagePreview.onload = () => {
        elements.imagePreview.hidden = false;
        elements.imagePlaceholder.hidden = true;
    };
    elements.imagePreview.onerror = () => {
        elements.imagePreview.hidden = true;
        elements.imagePlaceholder.hidden = false;
        elements.imagePlaceholder.textContent = 'Image could not be loaded';
    };
    elements.imagePreview.alt = project.title
        ? `Preview for ${project.title}`
        : 'Project image preview';
    elements.imagePreview.src = url;
}

function renderCategoryChoices() {
    const project = currentProject();
    elements.categoryChoices.replaceChildren();
    if (!project) return;

    state.data.categoryOrder
        .filter(category => category !== 'Featured')
        .forEach(category => {
            const label = document.createElement('label');
            label.className = 'choice';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = (project.categories || []).includes(category);
            checkbox.value = category;
            checkbox.addEventListener('change', () => {
                project.categories = Array.isArray(project.categories) ? project.categories : [];
                if (checkbox.checked && !project.categories.includes(category)) {
                    project.categories.push(category);
                } else if (!checkbox.checked) {
                    project.categories = project.categories.filter(value => value !== category);
                }
                sortProjectCategories(project);
                state.touchedFields.add('categories');
                markChanged({ list: true });
            });

            const text = document.createElement('span');
            text.textContent = category;
            label.append(checkbox, text);
            elements.categoryChoices.appendChild(label);
        });
}

function renderTags() {
    const project = currentProject();
    elements.tagList.replaceChildren();
    if (!project) return;

    (project.tags || []).forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        const text = document.createElement('span');
        text.textContent = tag;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Delete tag ${tag}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
            project.tags.splice(index, 1);
            state.touchedFields.add('tags');
            renderTags();
            markChanged({ list: true });
        });
        chip.append(text, remove);
        elements.tagList.appendChild(chip);
    });
}

function createLinkField(labelText, value, inputType, onInput) {
    const label = document.createElement('label');
    label.className = 'field';
    const text = document.createElement('span');
    text.textContent = labelText;
    const input = document.createElement('input');
    input.type = inputType;
    input.value = value || '';
    input.autocomplete = 'off';
    input.addEventListener('input', () => {
        onInput(input.value);
        markChanged();
    });
    input.addEventListener('blur', () => {
        state.touchedFields.add('links');
        renderValidation();
    });
    label.append(text, input);
    return { label, input };
}

function renderLinks() {
    const project = currentProject();
    elements.linkList.replaceChildren();
    if (!project) return;

    const links = Array.isArray(project.links) ? project.links : [];
    elements.linksEmpty.hidden = links.length > 0;

    links.forEach((link, index) => {
        const row = document.createElement('div');
        row.className = 'link-row';

        const labelField = createLinkField('Label', link.label, 'text', value => {
            link.label = value;
        });
        const urlField = createLinkField('URL', link.url, 'url', value => {
            link.url = value;
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button danger remove-link-button';
        remove.textContent = 'Delete';
        remove.setAttribute('aria-label', `Delete link ${index + 1}`);
        remove.addEventListener('click', () => {
            links.splice(index, 1);
            state.touchedFields.add('links');
            renderLinks();
            markChanged();
        });

        row.append(labelField.label, urlField.label, remove);
        elements.linkList.appendChild(row);
    });
}

function renderEditor() {
    const project = currentProject();
    elements.loadingPanel.hidden = true;
    elements.projectForm.hidden = !project;
    elements.emptyPanel.hidden = Boolean(project);

    if (!project) {
        renderValidation();
        return;
    }

    const index = currentIndex();
    elements.positionLabel.textContent = `Project ${index + 1} of ${state.data.projects.length}`;
    elements.editorTitle.textContent = project.title || 'Untitled project';
    elements.moveUpButton.disabled = index <= 0;
    elements.moveDownButton.disabled = index < 0 || index >= state.data.projects.length - 1;

    elements.titleInput.value = project.title || '';
    elements.idInput.value = project.id || '';
    elements.imageInput.value = project.image || '';
    elements.yearInput.value = project.year ?? '';
    elements.matchInput.value = project.match ?? '';
    elements.featuredInput.checked = Boolean(project.featured);
    elements.synopsisInput.value = project.synopsis || '';
    elements.synopsisCount.textContent = `${elements.synopsisInput.value.length} characters`;

    renderImageOptions();
    renderImagePreview();
    renderCategoryChoices();
    renderTags();
    renderLinks();
    renderValidation();
}

function renderAll() {
    renderProjectList();
    renderEditor();
    updateSaveState();
}

function sortProjectCategories(project) {
    const order = new Map(state.data.categoryOrder.map((category, index) => [category, index]));
    project.categories = [...new Set(project.categories || [])]
        .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

function validateData() {
    const errors = [];
    const add = (projectIndex, field, message) => errors.push({ projectIndex, field, message });
    const categories = state.data.categoryOrder;
    const categorySet = new Set(categories);
    const categoryNames = new Set();

    if (!categories.includes('Featured')) {
        add(-1, 'categories', 'Featured must remain in the category list.');
    }

    categories.forEach(category => {
        const clean = String(category || '').trim();
        if (!clean) {
            add(-1, 'categories', 'Category names cannot be empty.');
        } else if (categoryNames.has(clean.toLowerCase())) {
            add(-1, 'categories', `Category "${clean}" is listed more than once.`);
        }
        categoryNames.add(clean.toLowerCase());
    });

    const ids = new Set();
    let featuredCount = 0;

    state.data.projects.forEach((project, projectIndex) => {
        const id = String(project.id || '');
        if (!id) {
            add(projectIndex, 'id', 'Please enter an ID.');
        } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
            add(projectIndex, 'id', 'Use lowercase letters, numbers, and single hyphens.');
        } else if (ids.has(id)) {
            add(projectIndex, 'id', `The ID "${id}" is already in use.`);
        }
        ids.add(id);

        if (!String(project.title || '').trim()) {
            add(projectIndex, 'title', 'Please enter a project title.');
        }

        if (typeof project.image !== 'string') {
            add(projectIndex, 'image', 'Enter an image filename or URL.');
        }

        if (!Number.isInteger(project.year) || project.year < 1900 || project.year > 2100) {
            add(projectIndex, 'year', 'Enter a whole year from 1900 through 2100.');
        }

        if (!Number.isInteger(project.match) || project.match < 0 || project.match > 100) {
            add(projectIndex, 'match', 'Enter a whole match score from 0 through 100.');
        }

        const projectCategories = Array.isArray(project.categories) ? project.categories : [];
        const visibleCategories = projectCategories.filter(category => category !== 'Featured');
        if (visibleCategories.length === 0) {
            add(projectIndex, 'categories', 'Select at least one category.');
        }
        projectCategories.forEach(category => {
            if (!categorySet.has(category)) {
                add(projectIndex, 'categories', `Category "${category}" is not in the category list.`);
            }
        });

        const tags = Array.isArray(project.tags) ? project.tags : [];
        const seenTags = new Set();
        tags.forEach(tag => {
            const clean = String(tag || '').trim();
            if (!clean) {
                add(projectIndex, 'tags', 'Tags cannot be empty.');
            } else if (seenTags.has(clean.toLowerCase())) {
                add(projectIndex, 'tags', `Tag "${clean}" is listed more than once.`);
            }
            seenTags.add(clean.toLowerCase());
        });

        if (project.featured) featuredCount += 1;
        if (Boolean(project.featured) !== projectCategories.includes('Featured')) {
            add(projectIndex, 'categories', 'Featured status and the Featured category must match.');
        }

        if (!String(project.synopsis || '').trim()) {
            add(projectIndex, 'synopsis', 'Please enter a synopsis.');
        }

        if (!Array.isArray(project.links)) {
            add(projectIndex, 'links', 'Links must be a list.');
        } else {
            project.links.forEach(link => {
                if (!String(link?.label || '').trim()) {
                    add(projectIndex, 'links', 'Each link needs a label.');
                }
                if (!isHttpUrl(String(link?.url || ''))) {
                    add(projectIndex, 'links', 'Link URLs must start with http:// or https://.');
                }
            });
        }
    });

    if (state.data.projects.length > 0 && featuredCount !== 1) {
        add(-1, 'featured', 'Select exactly one featured project.');
    }

    return errors;
}

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
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
    const errors = validateData();
    const projectIndex = currentIndex();
    const currentErrors = errors.filter(error => error.projectIndex === projectIndex);

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
            const project = state.data.projects[error.projectIndex];
            item.textContent = project
                ? `${project.title || 'Untitled project'}: ${error.message}`
                : error.message;
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
    const project = state.data.projects[error.projectIndex];
    if (project) state.selectedProject = project;
    renderAll();

    requestAnimationFrame(() => {
        elements.validationSummary.focus();
        const target = inputElements[error.field];
        if (target) target.focus();
    });
}

async function loadState({ confirmDiscard = false } = {}) {
    if (confirmDiscard && isDirty() && !window.confirm('Reload projects.json and discard unsaved changes?')) {
        return;
    }

    hideError();
    elements.workspace.setAttribute('aria-busy', 'true');
    elements.loadingPanel.hidden = false;
    elements.projectForm.hidden = true;
    elements.emptyPanel.hidden = true;
    elements.reloadButton.disabled = true;
    elements.saveButton.disabled = true;
    elements.saveState.textContent = 'Loading projects';
    elements.saveState.dataset.state = '';

    try {
        const response = await fetch('/api/state');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || 'The editor could not read projects.json.');

        state.data = payload.data;
        state.images = payload.images || [];
        state.savedJson = JSON.stringify(state.data);
        state.selectedProject = state.data.projects[0] || null;
        state.query = '';
        state.idAuto = false;
        state.showValidation = false;
        state.touchedFields.clear();

        elements.projectPath.textContent = payload.paths?.projects || 'projects.json';
        elements.projectSearch.value = '';
        renderAll();
    } catch (error) {
        elements.loadingPanel.hidden = true;
        elements.emptyPanel.hidden = false;
        showError('Could not load projects.', `${error.message} Start the editor again if the server window was closed.`);
    } finally {
        elements.workspace.setAttribute('aria-busy', 'false');
        elements.reloadButton.disabled = false;
    }
}

async function saveProjects() {
    if (!isDirty()) return;

    state.showValidation = true;
    const errors = validateData();
    if (errors.length > 0) {
        focusValidationError(errors[0]);
        showToast(`Fix ${errors.length} ${errors.length === 1 ? 'issue' : 'issues'} before saving.`);
        return;
    }

    elements.saveButton.disabled = true;
    elements.reloadButton.disabled = true;
    elements.saveButton.textContent = 'Saving';
    elements.saveState.textContent = 'Saving projects.json';
    elements.saveState.dataset.state = '';

    try {
        const response = await fetch('/api/projects', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.data)
        });
        const payload = await response.json();

        if (!response.ok) {
            if (response.status === 422 && Array.isArray(payload.errors)) {
                throw new Error(payload.errors[0]?.message || 'The server rejected the project data.');
            }
            throw new Error(payload.message || 'projects.json was not saved.');
        }

        state.savedJson = JSON.stringify(state.data);
        state.showValidation = false;
        state.touchedFields.clear();
        renderValidation();
        updateSaveState();
        showToast(payload.changed
            ? `Saved projects.json. Backup: ${payload.backup}`
            : 'projects.json already matches these changes.');
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

function createProject() {
    const category = state.data.categoryOrder.find(value => value !== 'Featured') || '';
    const project = {
        id: uniqueId('new-project'),
        title: 'New project',
        image: '',
        categories: category ? [category] : [],
        year: new Date().getFullYear(),
        match: 90,
        tags: [],
        featured: false,
        synopsis: '',
        links: []
    };

    state.data.projects.push(project);
    state.selectedProject = project;
    state.idAuto = true;
    state.showValidation = false;
    state.touchedFields.clear();
    state.query = '';
    elements.projectSearch.value = '';
    renderAll();
    requestAnimationFrame(() => {
        elements.titleInput.select();
    });
}

function duplicateProject() {
    const project = currentProject();
    if (!project) return;
    const copy = deepClone(project);
    copy.title = `${project.title || 'Untitled project'} copy`;
    copy.id = uniqueId(`${project.id || project.title || 'project'}-copy`);
    copy.featured = false;
    copy.categories = (copy.categories || []).filter(category => category !== 'Featured');

    const insertAt = currentIndex() + 1;
    state.data.projects.splice(insertAt, 0, copy);
    state.selectedProject = copy;
    state.idAuto = true;
    state.showValidation = false;
    state.touchedFields.clear();
    renderAll();
    showToast(`Duplicated ${project.title || 'project'}.`);
}

function deleteProject() {
    const project = currentProject();
    if (!project) return;

    const index = currentIndex();
    state.data.projects.splice(index, 1);
    state.selectedProject = state.data.projects[index] || state.data.projects[index - 1] || null;
    state.showValidation = false;
    state.touchedFields.clear();
    renderAll();

    showToast(`Deleted ${project.title || 'project'}. Save changes to write the file.`, 'Undo', () => {
        state.data.projects.splice(index, 0, project);
        state.selectedProject = project;
        renderAll();
    }, 8000);
}

function moveProject(delta) {
    const project = currentProject();
    const from = currentIndex();
    const to = from + delta;
    if (!project || to < 0 || to >= state.data.projects.length) return;
    state.data.projects.splice(from, 1);
    state.data.projects.splice(to, 0, project);
    renderAll();
}

function reorderProject(source, target) {
    const from = state.data.projects.indexOf(source);
    let to = state.data.projects.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    state.data.projects.splice(from, 1);
    if (from < to) to -= 1;
    state.data.projects.splice(to, 0, source);
    renderAll();
}

function addTags(rawValue) {
    const project = currentProject();
    if (!project) return;

    const additions = String(rawValue || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    if (!additions.length) return;

    project.tags = Array.isArray(project.tags) ? project.tags : [];
    const existing = new Set(project.tags.map(tag => tag.toLowerCase()));
    additions.forEach(tag => {
        if (!existing.has(tag.toLowerCase())) {
            project.tags.push(tag);
            existing.add(tag.toLowerCase());
        }
    });

    elements.tagInput.value = '';
    state.touchedFields.add('tags');
    renderTags();
    markChanged({ list: true });
}

function setFeatured(checked) {
    const project = currentProject();
    if (!project) return;

    if (checked) {
        state.data.projects.forEach(item => {
            item.featured = item === project;
            item.categories = (item.categories || []).filter(category => category !== 'Featured');
            if (item === project) item.categories.unshift('Featured');
            sortProjectCategories(item);
        });
    } else {
        project.featured = false;
        project.categories = (project.categories || []).filter(category => category !== 'Featured');
    }
    markChanged({ list: true });
}

async function uploadImage(file) {
    if (!file) return;
    const project = currentProject();
    if (!project) {
        showToast('Select a project before adding an image.');
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
        if (!response.ok) throw new Error(payload.message || 'The image was not added.');

        if (!state.images.includes(payload.filename)) {
            state.images.push(payload.filename);
            state.images.sort((a, b) => a.localeCompare(b));
        }
        project.image = payload.filename;
        elements.imageInput.value = payload.filename;
        renderImageOptions();
        renderImagePreview();
        markChanged({ list: true });
        showToast(`Added ${payload.filename}.`);
    } catch (error) {
        showToast(`${error.message} Choose a different image and try again.`);
    } finally {
        elements.dropZone.classList.remove('is-uploading');
        elements.dropTitle.textContent = 'Drop an image here';
        elements.imageUpload.disabled = false;
        elements.imageUpload.value = '';
    }
}

function categoryUsage(category) {
    return state.data.projects.filter(project => (project.categories || []).includes(category)).length;
}

function renderCategoryDialog() {
    elements.categoryList.replaceChildren();

    state.categoryDraft.forEach((entry, index) => {
        const category = entry.name;
        const isFeatured = entry.original === 'Featured';
        const row = document.createElement('div');
        row.className = 'category-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = category;
        input.disabled = isFeatured;
        input.setAttribute('aria-label', `Category ${index + 1}`);
        input.addEventListener('input', () => {
            entry.name = input.value;
            elements.categoryDialogError.textContent = '';
        });

        const usage = document.createElement('span');
        usage.className = 'category-usage';
        const count = categoryUsage(entry.original || category);
        usage.textContent = `${count} ${count === 1 ? 'project' : 'projects'}`;

        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'button secondary compact';
        up.textContent = 'Up';
        up.disabled = index === 0 || isFeatured || state.categoryDraft[index - 1]?.original === 'Featured';
        up.setAttribute('aria-label', `Move ${category} up`);
        up.addEventListener('click', () => {
            [state.categoryDraft[index - 1], state.categoryDraft[index]] =
                [state.categoryDraft[index], state.categoryDraft[index - 1]];
            renderCategoryDialog();
        });

        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'button secondary compact';
        down.textContent = 'Down';
        down.disabled = index === state.categoryDraft.length - 1 || isFeatured;
        down.setAttribute('aria-label', `Move ${category} down`);
        down.addEventListener('click', () => {
            [state.categoryDraft[index + 1], state.categoryDraft[index]] =
                [state.categoryDraft[index], state.categoryDraft[index + 1]];
            renderCategoryDialog();
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button danger compact';
        remove.textContent = 'Delete';
        remove.disabled = isFeatured || count > 0;
        remove.title = count > 0 ? 'Remove this category from its projects first.' : '';
        remove.addEventListener('click', () => {
            state.categoryDraft.splice(index, 1);
            renderCategoryDialog();
        });

        row.append(input, usage, up, down, remove);
        elements.categoryList.appendChild(row);
    });
}

function openCategoryDialog() {
    state.categoryDraft = state.data.categoryOrder.map(category => ({
        original: category,
        name: category
    }));
    elements.categoryDialogError.textContent = '';
    renderCategoryDialog();
    elements.categoryDialog.showModal();
}

function addCategory() {
    const existing = new Set(state.categoryDraft.map(entry => entry.name.toLowerCase()));
    let name = 'New category';
    let suffix = 2;
    while (existing.has(name.toLowerCase())) {
        name = `New category ${suffix}`;
        suffix += 1;
    }
    state.categoryDraft.push({ original: null, name });
    renderCategoryDialog();
    requestAnimationFrame(() => {
        const inputs = elements.categoryList.querySelectorAll('input:not(:disabled)');
        inputs[inputs.length - 1]?.select();
    });
}

function applyCategories() {
    const categories = state.categoryDraft.map(entry => String(entry.name || '').trim());
    const lower = categories.map(value => value.toLowerCase());
    if (categories.some(value => !value)) {
        elements.categoryDialogError.textContent = 'Category names cannot be empty.';
        return;
    }
    if (new Set(lower).size !== categories.length) {
        elements.categoryDialogError.textContent = 'Category names must be unique.';
        return;
    }
    if (!categories.includes('Featured')) {
        elements.categoryDialogError.textContent = 'Featured must remain in the category list.';
        return;
    }

    const renamed = new Map();
    state.categoryDraft.forEach((entry, index) => {
        if (entry.original && entry.original !== categories[index]) {
            renamed.set(entry.original, categories[index]);
        }
    });

    state.data.categoryOrder = categories;
    state.data.projects.forEach(project => {
        project.categories = [...new Set(
            (project.categories || []).map(category => renamed.get(category) || category)
        )];
        sortProjectCategories(project);
    });
    elements.categoryDialog.close();
    renderCategoryChoices();
    renderProjectList();
    markChanged();
}

function bindStaticEvents() {
    elements.retryButton.addEventListener('click', () => loadState());
    elements.reloadButton.addEventListener('click', () => loadState({ confirmDiscard: true }));
    elements.saveButton.addEventListener('click', saveProjects);
    elements.newProjectButton.addEventListener('click', createProject);
    elements.emptyNewButton.addEventListener('click', createProject);

    elements.projectSearch.addEventListener('input', () => {
        state.query = elements.projectSearch.value;
        renderProjectList();
    });

    elements.moveUpButton.addEventListener('click', () => moveProject(-1));
    elements.moveDownButton.addEventListener('click', () => moveProject(1));
    elements.duplicateButton.addEventListener('click', duplicateProject);
    elements.deleteButton.addEventListener('click', deleteProject);

    elements.titleInput.addEventListener('input', () => {
        const project = currentProject();
        if (!project) return;
        project.title = elements.titleInput.value;
        if (state.idAuto) {
            project.id = uniqueId(project.title, project);
            elements.idInput.value = project.id;
        }
        elements.editorTitle.textContent = project.title || 'Untitled project';
        markChanged({ list: true });
    });

    elements.idInput.addEventListener('input', () => {
        const project = currentProject();
        if (!project) return;
        project.id = elements.idInput.value;
        state.idAuto = false;
        markChanged({ list: true });
    });

    elements.imageInput.addEventListener('input', () => {
        const project = currentProject();
        if (!project) return;
        project.image = elements.imageInput.value;
        markChanged({ list: true });
    });
    elements.imageInput.addEventListener('change', renderImagePreview);

    elements.yearInput.addEventListener('input', () => {
        const project = currentProject();
        if (!project) return;
        project.year = elements.yearInput.value === '' ? null : Number(elements.yearInput.value);
        markChanged({ list: true });
    });

    elements.matchInput.addEventListener('input', () => {
        const project = currentProject();
        if (!project) return;
        project.match = elements.matchInput.value === '' ? null : Number(elements.matchInput.value);
        markChanged();
    });

    elements.featuredInput.addEventListener('change', () => {
        setFeatured(elements.featuredInput.checked);
        renderEditor();
    });

    elements.synopsisInput.addEventListener('input', () => {
        const project = currentProject();
        if (!project) return;
        project.synopsis = elements.synopsisInput.value;
        elements.synopsisCount.textContent = `${elements.synopsisInput.value.length} characters`;
        markChanged();
    });

    elements.projectForm.addEventListener('focusout', event => {
        const field = event.target.name;
        if (field && errorElements[field]) {
            state.touchedFields.add(field);
            renderValidation();
        }
    });

    elements.projectForm.addEventListener('submit', event => {
        event.preventDefault();
        saveProjects();
    });

    elements.tagInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTags(elements.tagInput.value);
        } else if (event.key === 'Backspace' && !elements.tagInput.value) {
            const project = currentProject();
            if (project?.tags?.length) {
                project.tags.pop();
                renderTags();
                markChanged({ list: true });
            }
        }
    });
    elements.tagInput.addEventListener('blur', () => addTags(elements.tagInput.value));

    elements.addLinkButton.addEventListener('click', () => {
        const project = currentProject();
        if (!project) return;
        project.links = Array.isArray(project.links) ? project.links : [];
        project.links.push({ label: '', url: '' });
        renderLinks();
        markChanged();
        requestAnimationFrame(() => {
            const rows = elements.linkList.querySelectorAll('.link-row');
            rows[rows.length - 1]?.querySelector('input')?.focus();
        });
    });

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
        const project = currentProject();
        const image = elements.existingImageSelect.value;
        if (!project || !image) {
            showToast('Choose an existing image first.');
            return;
        }
        project.image = image;
        elements.imageInput.value = image;
        renderImagePreview();
        markChanged({ list: true });
    });

    elements.editCategoriesButton.addEventListener('click', openCategoryDialog);
    elements.closeCategoryButton.addEventListener('click', () => elements.categoryDialog.close());
    elements.cancelCategoryButton.addEventListener('click', () => elements.categoryDialog.close());
    elements.addCategoryButton.addEventListener('click', addCategory);
    elements.categoryForm.addEventListener('submit', event => {
        event.preventDefault();
        applyCategories();
    });

    document.addEventListener('keydown', event => {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() === 's') {
            event.preventDefault();
            saveProjects();
        }
        if (event.key.toLowerCase() === 'n' && !elements.categoryDialog.open) {
            event.preventDefault();
            createProject();
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
