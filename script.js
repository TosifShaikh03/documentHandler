let directories = {};
let currentDocument = null;
let currentDirectory = null;
let saveQueue = []; // Queue for document saves
let isSaving = false; // Flag to prevent concurrent saves

// Load data from localStorage
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('directories')) {
        try {
            directories = JSON.parse(localStorage.getItem('directories'));
            console.log('Loaded directories:', directories);
            updateDirectorySelect();
            renderDirectoryList();
            renderRecentDocuments();
        } catch (e) {
            console.error('Error parsing localStorage:', e);
            alert('Failed to load saved directories. Clearing localStorage.');
            localStorage.removeItem('directories');
        }
    }
    const searchBar = document.getElementById('searchBar');
    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            console.log('Search query:', query);
            renderSearchResults(query);
        });
    } else {
        console.error('Search bar element not found');
    }
});

// Toggle Sidebar
document.getElementById('toggleSidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('hidden');
    console.log('Sidebar toggled:', sidebar.classList.contains('open') ? 'open' : 'closed');
});

// Close Sidebar via Backdrop
document.getElementById('sidebarBackdrop').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.add('hidden');
    sidebar.classList.remove('open');
    backdrop.classList.add('hidden');
    console.log('Sidebar closed via backdrop');
});

// Close Sidebar via Close Button
document.getElementById('closeSidebar').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.add('hidden');
    sidebar.classList.remove('open');
    backdrop.classList.add('hidden');
    console.log('Sidebar closed via close button');
});

// Create Directory
document.getElementById('createDirectory').addEventListener('click', () => {
    const dirName = document.getElementById('directoryName').value.trim();
    if (dirName && !directories[dirName]) {
        directories[dirName] = [];
        updateDirectorySelect();
        renderDirectoryList();
        saveToLocalStorage();
        document.getElementById('directoryName').value = '';
        console.log('Created directory:', dirName);
    } else {
        alert('Please enter a unique directory name.');
    }
});

// Delete Directory
function deleteDirectory(dirName) {
    if (confirm(`Are you sure you want to delete the directory "${dirName}" and all its documents?`)) {
        delete directories[dirName];
        if (currentDirectory === dirName) {
            currentDirectory = null;
        }
        updateDirectorySelect();
        renderDirectoryList();
        const searchQuery = document.getElementById('searchBar').value.trim();
        if (searchQuery) {
            renderSearchResults(searchQuery);
        } else if (currentDirectory) {
            renderDocuments(currentDirectory);
        } else {
            renderRecentDocuments();
        }
        saveToLocalStorage();
        console.log('Deleted directory:', dirName);
    }
}

// Save to localStorage with retry
async function saveToLocalStorage() {
    const maxRetries = 3;
    let attempt = 1;
    while (attempt <= maxRetries) {
        try {
            localStorage.setItem('directories', JSON.stringify(directories));
            console.log('Saved to localStorage (attempt ' + attempt + '):', directories);
            return true;
        } catch (e) {
            console.error('Error saving to localStorage (attempt ' + attempt + '):', e);
            if (attempt === maxRetries) {
                alert('Failed to save data after ' + maxRetries + ' attempts. localStorage may be full or disabled.');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            attempt++;
        }
    }
}

// Process save queue
async function processSaveQueue() {
    if (isSaving || saveQueue.length === 0) return;
    isSaving = true;
    const { directory, docData, fileInput, docNameInput, docDescInput } = saveQueue.shift();
    try {
        directories[directory].push(docData);
        console.log('Document added to:', directory, docData);

        const searchQuery = document.getElementById('searchBar').value.trim();
        if (!currentDirectory && !searchQuery) {
            renderRecentDocuments();
        } else if (currentDirectory === directory && !searchQuery) {
            renderDocuments(directory);
        } else if (searchQuery) {
            renderSearchResults(searchQuery);
        }

        const saved = await saveToLocalStorage();
        if (saved) {
            const savedData = JSON.parse(localStorage.getItem('directories'));
            if (savedData && savedData[directory].some(doc => doc.id === docData.id)) {
                console.log('Document successfully saved to localStorage:', docData.name);
                setTimeout(() => {
                    fileInput.value = '';
                    docNameInput.value = '';
                    docDescInput.value = '';
                    console.log('Inputs cleared');
                }, 500);
            } else {
                console.error('Failed to verify document in localStorage:', docData.name);
                alert('Failed to save document. Please try again.');
                directories[directory].pop(); // Revert addition
            }
        } else {
            directories[directory].pop(); // Revert addition
        }
    } catch (e) {
        console.error('Error processing save queue:', e);
        alert('Failed to process document. Please try again.');
        directories[directory].pop(); // Revert addition
    } finally {
        isSaving = false;
        if (saveQueue.length > 0) {
            processSaveQueue(); // Process next in queue
        }
    }
}

// Read file as Data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

// Add Document
document.getElementById('addDocument').addEventListener('click', async () => {
    const directory = document.getElementById('directorySelect').value;
    const fileInput = document.getElementById('documentImage');
    const docNameInput = document.getElementById('documentName');
    const docDescInput = document.getElementById('documentDescription');
    const docName = docNameInput.value.trim();
    const docDesc = docDescInput.value.trim();

    if (!directory) {
        alert('Please select a directory.');
        return;
    }
    if (!fileInput.files[0]) {
        alert('Please upload an image.');
        return;
    }
    if (!docName) {
        alert('Please enter a document name.');
        return;
    }

    const file = fileInput.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!validTypes.includes(file.type)) {
        alert('Please upload a valid image (JPEG, PNG, or GIF).');
        console.error('Invalid file type:', file.type);
        return;
    }
    if (file.size > maxSize) {
        alert('File size exceeds 5MB limit.');
        console.error('File too large:', file.size);
        return;
    }

    try {
        const imageData = await readFileAsDataURL(file);
        const docData = {
            id: Date.now(),
            name: docName,
            description: docDesc,
            image: imageData
        };
        saveQueue.push({ directory, docData, fileInput, docNameInput, docDescInput });
        console.log('Added document to save queue:', docName);
        processSaveQueue();
    } catch (e) {
        console.error('FileReader error:', e);
        alert('Error reading file. Please try a different image.');
    }
});

// Update Directory Select
function updateDirectorySelect() {
    const select = document.getElementById('directorySelect');
    select.innerHTML = '<option value="">Select Directory</option>';
    Object.keys(directories).forEach(dir => {
        const option = document.createElement('option');
        option.value = dir;
        option.textContent = dir;
        select.appendChild(option);
    });
    console.log('Updated directory select:', Object.keys(directories));
}

// Render Directory List in Sidebar
function renderDirectoryList() {
    const container = document.getElementById('directoryList');
    container.innerHTML = '';
    Object.keys(directories).forEach(dir => {
        const dirDiv = document.createElement('div');
        dirDiv.className = 'flex justify-between items-center';
        dirDiv.innerHTML = `
            <div class="sidebar-item p-2 rounded flex-1 ${currentDirectory === dir ? 'active' : ''} text-white" onclick="selectDirectory('${dir}')">${dir}</div>
            <button class="text-red-500 hover:text-red-700 ml-2" onclick="deleteDirectory('${dir}')">🗑️</button>
        `;
        container.appendChild(dirDiv);
    });
}

// Select Directory
function selectDirectory(dir) {
    currentDirectory = dir;
    document.getElementById('searchBar').value = ''; // Clear search bar
    renderDirectoryList();
    renderDocuments(dir);
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.add('hidden');
    console.log('Selected directory:', dir);
}

// Render Documents
function renderDocuments(dir) {
    const container = document.getElementById('documents');
    container.innerHTML = dir ? `<h2 class="text-xl font-semibold mb-2 text-white">${dir}</h2>` : '';
    if (dir && directories[dir]) {
        const docGrid = document.createElement('div');
        docGrid.className = 'grid grid-cols-2 gap-2';
        directories[dir].forEach(doc => {
            const docDiv = document.createElement('div');
            docDiv.className = 'document-card';
            docDiv.innerHTML = `
                <img src="${doc.image}" alt="${doc.name}" class="w-full h-32 object-cover rounded cursor-pointer">
                <p class="text-sm font-medium text-white">${doc.name}</p>
            `;
            docDiv.querySelector('img').onclick = () => showImageModal(doc.id, dir);
            docGrid.appendChild(docDiv);
        });
        container.appendChild(docGrid);
        console.log('Rendered documents for:', dir);
    }
}

// Render Recent Documents
function renderRecentDocuments() {
    const container = document.getElementById('documents');
    container.innerHTML = '<h2 class="text-xl font-semibold mb-2 text-white">Recently Added</h2>';
    const allDocs = [];
    Object.keys(directories).forEach(dir => {
        directories[dir].forEach(doc => {
            allDocs.push({ ...doc, directory: dir });
        });
    });
    allDocs.sort((a, b) => b.id - a.id); // Sort by id (timestamp) descending
    const recentDocs = allDocs.slice(0, 5); // Show up to 5 recent documents
    const docGrid = document.createElement('div');
    docGrid.className = 'grid grid-cols-2 gap-2';
    recentDocs.forEach(doc => {
        const docDiv = document.createElement('div');
        docDiv.className = 'document-card';
        docDiv.innerHTML = `
            <img src="${doc.image}" alt="${doc.name}" class="w-full h-32 object-cover rounded cursor-pointer">
            <p class="text-sm font-medium text-white">${doc.name} (${doc.directory})</p>
        `;
        docDiv.querySelector('img').onclick = () => showImageModal(doc.id, doc.directory);
        docGrid.appendChild(docDiv);
    });
    container.appendChild(docGrid);
    console.log('Rendered recent documents:', recentDocs);
}

// Render Search Results
function renderSearchResults(query) {
    const container = document.getElementById('documents');
    container.innerHTML = query ? `<h2 class="text-xl font-semibold mb-2 text-white">Search Results</h2>` : '';
    if (query) {
        const results = [];
        Object.keys(directories).forEach(dir => {
            directories[dir].forEach(doc => {
                if (doc.name.toLowerCase().includes(query) || (doc.description && doc.description.toLowerCase().includes(query))) {
                    results.push({ ...doc, directory: dir });
                }
            });
        });
        const docGrid = document.createElement('div');
        docGrid.className = 'grid grid-cols-2 gap-2';
        results.forEach(doc => {
            const docDiv = document.createElement('div');
            docDiv.className = 'document-card';
            docDiv.innerHTML = `
                <img src="${doc.image}" alt="${doc.name}" class="w-full h-32 object-cover rounded cursor-pointer">
                <p class="text-sm font-medium text-white">${doc.name} (${doc.directory})</p>
            `;
            docDiv.querySelector('img').onclick = () => showImageModal(doc.id, doc.directory);
            docGrid.appendChild(docDiv);
        });
        container.appendChild(docGrid);
        console.log('Search results:', results);
    } else if (currentDirectory) {
        renderDocuments(currentDirectory);
    } else {
        renderRecentDocuments();
    }
}

// Show Full-Screen Image Modal
function showImageModal(docId, dir) {
    const doc = directories[dir].find(doc => doc.id === docId);
    if (doc) {
        document.getElementById('fullScreenImage').src = doc.image;
        document.getElementById('imageModal').classList.remove('hidden');
        currentDocument = { id: docId, dir };
        console.log('Opened image modal for document:', doc.name);
    } else {
        console.error('Document not found:', docId, dir);
    }
}

// Close Full-Screen Image Modal
document.getElementById('closeImageModal').addEventListener('click', () => {
    document.getElementById('imageModal').classList.add('hidden');
    console.log('Closed image modal');
});

// Edit Document
function editDocument() {
    const doc = findDocument();
    if (doc) {
        document.getElementById('editModalImage').src = doc.image;
        document.getElementById('editModalName').value = doc.name;
        document.getElementById('editModalDescription').value = doc.description || '';
        document.getElementById('editModal').classList.remove('hidden');
        console.log('Opened edit modal for:', doc.name);
    } else {
        console.error('Document not found for editing');
    }
}

// Save Edited Document
function saveEditDocument() {
    const doc = findDocument();
    if (doc) {
        const newName = document.getElementById('editModalName').value.trim();
        const newDesc = document.getElementById('editModalDescription').value.trim();
        if (newName) {
            doc.name = newName;
            doc.description = newDesc;
            const searchQuery = document.getElementById('searchBar').value.trim();
            if (searchQuery) {
                renderSearchResults(searchQuery);
            } else if (currentDirectory) {
                renderDocuments(currentDirectory);
            } else {
                renderRecentDocuments();
            }
            saveToLocalStorage();
            document.getElementById('imageModal').classList.add('hidden');
            document.getElementById('editModal').classList.add('hidden');
            console.log('Saved edited document:', doc.name);
        } else {
            alert('Document name cannot be empty.');
        }
    } else {
        console.error('Document not found for saving edit');
    }
}

// Close Edit Modal
function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    console.log('Closed edit modal');
}

// Context Menu Actions
function printDocument() {
    const doc = findDocument();
    if (doc) {
        const printWindow = window.open('');
        printWindow.document.write(`
            <html>
                <body>
                    <img src="${doc.image}" style="width:100%;">
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        console.log('Printing document:', doc.name);
    } else {
        console.error('Document not found for printing');
    }
}

function shareDocument() {
    const doc = findDocument();
    if (doc && navigator.share) {
        navigator.share({
            title: doc.name,
            text: doc.description,
            url: doc.image
        }).catch(err => {
            console.error('Sharing failed:', err);
            alert('Sharing failed: ' + err);
        });
        console.log('Sharing document:', doc.name);
    } else {
        alert('Web Share API not supported or document not found.');
        console.error('Share failed: Web Share API not supported or document not found');
    }
}

function viewDocument() {
    const doc = findDocument();
    if (doc) {
        document.getElementById('modalImage').src = doc.image;
        document.getElementById('modalName').textContent = doc.name;
        document.getElementById('modalDescription').textContent = doc.description || '';
        document.getElementById('viewModal').classList.remove('hidden');
        console.log('Opened details modal for:', doc.name);
    } else {
        console.error('Document not found for viewing');
    }
}

function deleteDocument() {
    if (confirm('Are you sure you want to delete this document?')) {
        directories[currentDocument.dir] = directories[currentDocument.dir].filter(
            doc => doc.id !== currentDocument.id
        );
        if (directories[currentDocument.dir].length === 0) {
            delete directories[currentDocument.dir];
            currentDirectory = null;
            updateDirectorySelect();
            renderDirectoryList();
        }
        const searchQuery = document.getElementById('searchBar').value.trim();
        if (searchQuery) {
            renderSearchResults(searchQuery);
        } else if (currentDirectory) {
            renderDocuments(currentDirectory);
        } else {
            renderRecentDocuments();
        }
        document.getElementById('imageModal').classList.add('hidden');
        saveToLocalStorage();
        console.log('Deleted document:', currentDocument.id);
    }
}

function findDocument() {
    return directories[currentDocument.dir] ? directories[currentDocument.dir].find(doc => doc.id === currentDocument.id) : null;
}

function closeDetailsModal() {
    document.getElementById('viewModal').classList.add('hidden');
    console.log('Closed details modal');
}
