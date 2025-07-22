const CONFIG = loadSetting();
  
let boardData = loadData();
const board = document.getElementById('board');
const detailsPanel = document.getElementById('details-panel');
const detailsText = document.getElementById('details-text');
const deleteBtn = document.getElementById('delete-task-btn');
const linkInput = document.getElementById('task-link');
const openLinkBtn = document.getElementById('open-link-btn');
let activeTaskElement = null;
  
function loadData() {
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
      loaded[col] = loaded[col].map(t => typeof t === 'string' ? { text: t, description: '' } : t);
    }
  });

  return loaded;
}

function loadSetting() {
  let setting = {};
  try {
    setting = window.todoAPI.loadSetting();
  } catch (e) {
    console.error('❌ Fehler beim Laden der Einstellungen:', e);
  }

  return setting;
}
  
function saveData() {
  try {
    console.log("💾 Speichere Daten:", boardData);
    window.todoAPI.save(boardData);
  } catch (e) {
    console.error('❌ Fehler beim Speichern:', e);
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
  div.appendChild(input);

  div.onclick = () => {
    activeTaskElement = div;
    detailsPanel.classList.add('visible');
    detailsText.value = task.description || '';
    linkInput.value = task.link || '';
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

  return div;
}
  
function renderBoard() {
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
        boardData[columnName].push({ text: 'New Task', description: '', link: '' });
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
}
  
renderBoard();
  
document.addEventListener('keydown', (e) => {
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