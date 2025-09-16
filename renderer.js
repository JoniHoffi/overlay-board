let CONFIG;
let boardData;

const board = document.getElementById('board');
const detailsPanel = document.getElementById('details-panel');
const detailsText = document.getElementById('details-text');
const deleteBtn = document.getElementById('delete-task-btn');
const linkInput = document.getElementById('task-link');
const openLinkBtn = document.getElementById('open-link-btn');
const projectField = document.getElementById('task-project');
const dueDateField = document.getElementById('task-due-date');
let activeTaskElement = null;

async function init() {
  CONFIG = await window.settings.get();
  boardData = await loadData();
  renderBoard();
}

init();

async function loadData() {
  let loaded = {};
  try {
    loaded = window.todoAPI.load();
  } catch (e) {
    console.error('❌ Fehler beim Laden der Daten:', e);
  }

  console.log(CONFIG)

  CONFIG.columns.forEach(col => {
    if (!loaded[col]) {
      loaded[col] = [];
    } else {
      loaded[col] = loaded[col].map(t => typeof t === 'string' ? { text: t, description: '', project: '' } : t);
    }
  });

  return loaded;
}

async function loadSetting() {
  try {
    return await window.settings.get();
  } catch (e) {
    console.error('❌ Fehler beim Laden der Einstellungen:', e);
    return {};
  }
}
  
function saveData() {
  try {
    console.log("💾 Speichere Daten:", boardData);
    window.todoAPI.save(boardData);
  } catch (e) {
    console.error('❌ Fehler beim Speichern:', e);
  }
}

function updateDueClass(div, task) {
  div.classList.remove('due-today', 'due-warning');

  if (!task.dueDate) return;

  const today = new Date().toISOString().slice(0, 10);

  if (task.dueDate === today) {
    div.classList.add('due-today');
  } else if (task.dueDate < today) {
    div.classList.add('due-warning');
  }
}

function checkDone(div, task) {
  if (task.done) {
    div.classList.add('done')
  }
}
  
function createTaskElement(task, column) {
  const div = document.createElement('div');
  div.className = 'task';
  const input = document.createElement('input');
  input.value = task.text;
  input.onchange = () => {
    task.text = input.value;
    saveData();
  };

  updateDueClass(div, task);
  checkDone(div, task)

  div.appendChild(input);

  div.onclick = () => {
    activeTaskElement = div;
    detailsPanel.classList.add('visible');
    detailsText.value = task.description || '';
    linkInput.value = task.link || '';

    if (projectField) {
      projectField.value = task.project || '';
      projectField.oninput = () => {
        task.project = projectField.value;
        saveData();
      };
    }

    if (dueDateField) {
      dueDateField.value = task.dueDate || null;
      dueDateField.onchange = () => {
        task.dueDate = dueDateField.value;
        updateDueClass(div, task);
        saveData();
      }
    }

    autoResize(detailsText);
    detailsText.oninput = () => {
      task.description = detailsText.value;
      saveData();
      autoResize(detailsText);
    };
    linkInput.oninput = () => {
      task.link = linkInput.value;
      saveData();
    };

    openLinkBtn.onclick = () => {
      const url = task.link;
      if (url && /^https?:\/\//.test(url)) {
        window.todoAPI.openExternal(url);
        window.todoAPI.hideWindow?.();
      } else {
        alert("Bitte eine gültige URL eingeben (http/https)");
      }
    };

    deleteBtn.replaceWith(deleteBtn.cloneNode(true));
    const newDeleteBtn = document.getElementById('delete-task-btn');
    newDeleteBtn.onclick = () => {
      const index = boardData[column].indexOf(task);
      if (index !== -1) {
        boardData[column].splice(index, 1);
        activeTaskElement = null;
        saveData();
        renderBoard();
        detailsPanel.classList.remove('visible');
      }
    };
  };

  div.ondblclick = () => {
    if (div.classList.contains('done')) {
      div.classList.remove('done')
      task.done = false
      saveData()
    } else {
      div.classList.add('done')
      task.done = true
      saveData()
    }
  }

  return div;
}
  
function renderBoard() {
  if (!CONFIG || !Array.isArray(CONFIG.columns)) {
    console.warn('renderBoard: CONFIG/columns noch nicht verfügbar – warte auf init');
    return;
  }
  board.innerHTML = '';
  CONFIG.columns.forEach(columnName => {
    const tasks = boardData[columnName] || [];
    const col = document.createElement('div');
    col.className = 'column';

    const title = document.createElement('h2');
    title.textContent = columnName;
    col.appendChild(title);

    const taskList = document.createElement('div');
    taskList.className = 'task-list';
    tasks.forEach(task => {
      taskList.appendChild(createTaskElement(task, columnName));
    });

    col.appendChild(taskList);

    const trash = document.createElement('div');
    trash.className = 'trash-zone';
    trash.textContent = '🗑️ Löschen';

    new Sortable(trash, {
      group: 'shared',
      animation: 150,
      onAdd: (evt) => {
        const oldCol = evt.from.parentElement.querySelector('h2')?.textContent;
        if (!oldCol) return;
        boardData[oldCol].splice(evt.oldIndex, 1);
        saveData();
        renderBoard();
      }
    });

    col.appendChild(trash);

    board.appendChild(col);

    taskList.addEventListener("dblclick", (e) => {
      if (!e.target.closest('.task')) {
        boardData[columnName].push({ text: 'New Task', description: '', link: '', project: '', dueDate: null, done: false });
        saveData();
        renderBoard();
      }
    });

    new Sortable(taskList, {
      group: 'shared',
      animation: 150,
      draggable: '.task',
      onAdd: (evt) => {
        const oldCol = evt.from.parentElement.querySelector('h2').textContent;
        const newCol = evt.to.parentElement.querySelector('h2').textContent;
        const movedTask = boardData[oldCol].splice(evt.oldIndex, 1)[0];
        boardData[newCol].splice(evt.newIndex, 0, movedTask);
        saveData();
      },
      onUpdate: (evt) => {
        const col = evt.from.parentElement.querySelector('h2').textContent;
        const columnTasks = boardData[col];
        const movedTask = columnTasks.splice(evt.oldIndex, 1)[0];
        columnTasks.splice(evt.newIndex, 0, movedTask);
        saveData();
      }
    });
  });

  if (!activeTaskElement) {
    detailsPanel.classList.add('hidden');
  }

  document.querySelectorAll('.column').forEach(columnEl => {
  columnEl.addEventListener('dragover', e => {
    e.preventDefault();
    columnEl.classList.add('drag-over');
  });

  columnEl.addEventListener('dragleave', () => {
    columnEl.classList.remove('drag-over');
  });

  columnEl.addEventListener('drop', async e => {
    e.preventDefault();
    columnEl.classList.remove('drag-over');

    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');

    if (!url || !url.startsWith('http')) return;

    const result = await fetchPageTitle(url);
    const title = result?.title || 'Link';
    const description = result?.notes || '';
    const project = result?.meta?.pageSubtitle || '';
    const columnName = columnEl.querySelector('h2')?.textContent.trim() || 'ToDo';

    const newTask = {
      text: title,
      description,
      link: url,
      project,
    };

    boardData[columnName].push(newTask);
    saveData();
    renderBoard();
  });
});
}
  

if (window.settingsEvents?.onUpdated) {
  window.settingsEvents.onUpdated((next) => {
    // Falls Spalten sich geändert haben, passe boardData-Keys an
    if (Array.isArray(next.columns)) {
      const nextData = {};
      next.columns.forEach(col => {
        nextData[col] = boardData[col] || [];
      });
      boardData = nextData;
      CONFIG.columns = next.columns;
      renderBoard();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey && (e.key === 'Backspace' || e.key === 'Delete')) {
    e.preventDefault();

    if (activeTaskElement) {
      const columnName = activeTaskElement.closest('.column').querySelector('h2').textContent;
      const taskIndex = Array.from(activeTaskElement.parentNode.children).indexOf(activeTaskElement);

      if (taskIndex > -1) {
        boardData[columnName].splice(taskIndex, 1);
        activeTaskElement = null;
        saveData();
        renderBoard();
        detailsPanel.classList.remove('visible');
      }
    }
  }

  if (e.key === 'Escape') {
    window.todoAPI.hideWindow?.();
  }
});

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

document.addEventListener('click', (e) => {
  const isTask = e.target.closest('.task');
  const isDetails = e.target.closest('#details-panel');

  if (!isTask && !isDetails) {
    activeTaskElement = null;
    detailsPanel.classList.remove('visible');
  }
});

document.getElementById('login-basecamp-btn').addEventListener('click', () => {
  window.todoAPI.openBasecampLogin();
});

async function fetchPageTitle(url) {
  try {
    console.log("📡 Titel wird angefragt für:", url);
    const title = await window.todoAPI.fetchTitle(url);
    console.log("✅ Titel empfangen:", title);
    return title || 'Link';
  } catch (err) {
    console.warn('Fehler beim Titel laden:', err);
    return 'Link';
  }
}