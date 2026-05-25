const STORAGE_KEY = 'fans-local-collection-v1';

const labels = {
  visibility: {
    private: '私密',
    unlisted: '仅链接',
    public: '公开',
  },
  mode: {
    type: '按类型',
    time: '按时间',
    custom: '自定义',
  },
  itemType: {
    link: '链接',
    source: '来源记录',
    attachment: '私密附件',
  },
  status: {
    available: '可访问',
    login: '需要登录',
    appOnly: '仅 App 内',
    halfYear: '半年可见',
    unavailable: '暂不可访问',
    deleted: '已删除',
    unverified: '来源不可验证',
    maybeInvalid: '可能失效',
    privateOnly: '私密',
  },
};

let state = loadState();
let currentView = 'collections';
let currentCollectionId = null;
let currentItemType = 'link';
let pendingConfirm = null;

const els = {
  viewRoot: document.querySelector('#viewRoot'),
  pageTitle: document.querySelector('#pageTitle'),
  pageSub: document.querySelector('#pageSub'),
  statCollections: document.querySelector('#statCollections'),
  statItems: document.querySelector('#statItems'),
  statInbox: document.querySelector('#statInbox'),
  statPrivate: document.querySelector('#statPrivate'),
  collectionDialog: document.querySelector('#collectionDialog'),
  itemDialog: document.querySelector('#itemDialog'),
  confirmDialog: document.querySelector('#confirmDialog'),
};

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  render();
});

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse local state, using seed data.', error);
    }
  }
  return seedState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedState() {
  const c1 = {
    id: uid(),
    title: '成员入坑资料包',
    desc: '代表舞台、采访和综艺，适合按顺序补课。',
    mode: 'type',
    visibility: 'public',
    groups: ['舞台', '采访', '综艺'],
    createdAt: now(),
    updatedAt: now(),
  };
  const c2 = {
    id: uid(),
    title: '考研英语资料',
    desc: '词汇、阅读、作文、真题讲解整理。',
    mode: 'type',
    visibility: 'private',
    groups: ['词汇', '阅读', '作文', '真题'],
    createdAt: now(),
    updatedAt: now(),
  };
  return {
    collections: [c1, c2],
    items: [
      {
        id: uid(),
        collectionId: c1.id,
        itemType: 'link',
        title: '2018 初登场舞台',
        url: 'https://www.bilibili.com/video/BVxxxx',
        platform: 'Bilibili',
        author: '官方账号',
        category: '舞台',
        time: '2018',
        tags: '入坑必看',
        status: 'available',
        note: '公开页可跳转原站查看。',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uid(),
        collectionId: c1.id,
        itemType: 'source',
        title: '2020 微信视频号片段',
        url: '',
        platform: '微信视频号',
        author: '@某账号',
        category: '采访',
        time: '2020',
        tags: '来源记录',
        status: 'appOnly',
        note: '公开页只展示来源，不展示截图或原内容。',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uid(),
        collectionId: c1.id,
        itemType: 'attachment',
        title: '个人整理截图',
        url: '',
        platform: '本地附件',
        author: '',
        category: '综艺',
        time: '2021',
        tags: '私密',
        status: 'privateOnly',
        note: '这里只记录附件线索，文件本身不上传。',
        createdAt: now(),
        updatedAt: now(),
      },
      {
        id: uid(),
        collectionId: '',
        itemType: 'link',
        title: '访谈视频合集',
        url: '',
        platform: 'Bilibili',
        author: '',
        category: '采访',
        time: '',
        tags: '',
        status: 'maybeInvalid',
        note: '未选择合集，待归档。',
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    favorites: [],
  };
}

function bindGlobalEvents() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      currentView = button.dataset.view;
      currentCollectionId = null;
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      render();
    });
  });

  document.querySelector('#newCollectionBtn').addEventListener('click', () => openCollectionDialog());
  document.querySelector('#quickAddItemBtn').addEventListener('click', () => openItemDialog());
  document.querySelector('#saveCollectionBtn').addEventListener('click', saveCollectionFromDialog);
  document.querySelector('#saveItemBtn').addEventListener('click', saveItemFromDialog);

  document.querySelectorAll('[data-item-type]').forEach((button) => {
    button.addEventListener('click', () => {
      currentItemType = button.dataset.itemType;
      document.querySelectorAll('[data-item-type]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      syncItemDialogForType();
    });
  });

  document.querySelector('#confirmCancelBtn').addEventListener('click', () => els.confirmDialog.close());
  document.querySelector('#confirmNoBtn').addEventListener('click', () => els.confirmDialog.close());
  document.querySelector('#confirmYesBtn').addEventListener('click', () => {
    if (pendingConfirm) pendingConfirm();
    pendingConfirm = null;
    els.confirmDialog.close();
  });

  document.querySelectorAll('.dialog-close').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelector(`#${button.dataset.dialog}`).close();
    });
  });
}

function render() {
  updateStats();
  if (currentCollectionId) {
    renderCollectionDetail(currentCollectionId);
    return;
  }
  if (currentView === 'collections') renderCollections();
  if (currentView === 'inbox') renderInbox();
  if (currentView === 'all') renderAllItems();
  if (currentView === 'settings') renderSettings();
}

function updateStats() {
  els.statCollections.textContent = state.collections.length;
  els.statItems.textContent = state.items.length;
  els.statInbox.textContent = state.items.filter((item) => !item.collectionId).length;
  els.statPrivate.textContent = state.items.filter((item) => item.itemType === 'attachment').length;
}

function setHeader(title, sub) {
  els.pageTitle.textContent = title;
  els.pageSub.textContent = sub;
}

function renderCollections() {
  setHeader('合集', '把链接、来源记录和私密附件记录整理成主题资料包。');
  const html = `
    <div class="toolbar">
      <div class="toolbar-group">
        <input class="search" id="collectionSearch" placeholder="搜索合集" />
      </div>
      <div class="toolbar-group">
        <button class="secondary" data-action="export">导出备份</button>
      </div>
    </div>
    <div class="grid" id="collectionGrid"></div>
  `;
  els.viewRoot.innerHTML = html;
  document.querySelector('[data-action="export"]').addEventListener('click', exportData);
  document.querySelector('#collectionSearch').addEventListener('input', (event) => {
    paintCollectionGrid(event.target.value);
  });
  paintCollectionGrid('');
}

function paintCollectionGrid(query) {
  const list = state.collections.filter((collection) => {
    const q = query.trim();
    if (!q) return true;
    return collection.title.includes(q) || collection.desc.includes(q);
  });
  const root = document.querySelector('#collectionGrid');
  if (!list.length) {
    root.innerHTML = `<div class="empty">还没有合集，先新建一个试试。</div>`;
    return;
  }
  root.innerHTML = list.map(collectionCard).join('');
  root.querySelectorAll('[data-open-collection]').forEach((button) => {
    button.addEventListener('click', () => {
      currentCollectionId = button.dataset.openCollection;
      render();
    });
  });
  root.querySelectorAll('[data-edit-collection]').forEach((button) => {
    button.addEventListener('click', () => openCollectionDialog(button.dataset.editCollection));
  });
  root.querySelectorAll('[data-delete-collection]').forEach((button) => {
    button.addEventListener('click', () => confirmDelete('删除合集会同时移除其中条目，确定吗？', () => {
      const id = button.dataset.deleteCollection;
      state.collections = state.collections.filter((item) => item.id !== id);
      state.items = state.items.filter((item) => item.collectionId !== id);
      saveState();
      render();
    }));
  });
}

function collectionCard(collection) {
  const count = itemsForCollection(collection.id).length;
  return `
    <article class="card collection-card">
      <div class="card-head">
        <div class="mark ${visibilityClass(collection.visibility)}">${escapeHtml(collection.title.slice(0, 1) || '集')}</div>
        <div>
          <h3>${escapeHtml(collection.title)}</h3>
          <p>${escapeHtml(collection.desc || '暂无简介')}</p>
        </div>
      </div>
      <div class="chips">
        <span class="chip ${collection.visibility === 'public' ? 'green' : ''}">${labels.visibility[collection.visibility]}</span>
        <span class="chip">${labels.mode[collection.mode]}</span>
        <span class="chip">${count} 条</span>
        ${collection.groups.map((group) => `<span class="chip blue">${escapeHtml(group)}</span>`).join('')}
      </div>
      <div class="card-actions">
        <button class="secondary" data-open-collection="${collection.id}">打开</button>
        <button class="ghost" data-edit-collection="${collection.id}">编辑</button>
        <button class="ghost" data-delete-collection="${collection.id}">删除</button>
      </div>
    </article>
  `;
}

function renderCollectionDetail(collectionId) {
  const collection = getCollection(collectionId);
  if (!collection) {
    currentCollectionId = null;
    renderCollections();
    return;
  }
  setHeader(collection.title, collection.desc || '暂无简介');
  const items = itemsForCollection(collectionId);
  const groupOptions = ['全部', ...new Set([...collection.groups, ...items.map((item) => item.category).filter(Boolean)])];
  els.viewRoot.innerHTML = `
    <div class="detail-layout">
      <aside class="card hero-card">
        <h3>${escapeHtml(collection.title)}</h3>
        <p>${escapeHtml(collection.desc || '暂无简介')}</p>
        <div class="chips">
          <span class="chip">${labels.visibility[collection.visibility]}</span>
          <span class="chip">${labels.mode[collection.mode]}</span>
          <span class="chip">${items.length} 条</span>
        </div>
        <div class="card-actions">
          <button class="secondary" id="backToCollections">返回合集</button>
          <button class="secondary" id="sharePreviewBtn">公开预览</button>
        </div>
      </aside>
      <section>
        <div class="toolbar">
          <div class="toolbar-group">
            <input class="search" id="itemSearch" placeholder="搜索条目" />
            <select id="groupFilter">${groupOptions.map((group) => `<option>${escapeHtml(group)}</option>`).join('')}</select>
          </div>
          <button class="primary" id="addItemToCollection">添加条目</button>
        </div>
        <div id="itemList"></div>
      </section>
    </div>
  `;
  document.querySelector('#backToCollections').addEventListener('click', () => {
    currentCollectionId = null;
    renderCollections();
  });
  document.querySelector('#sharePreviewBtn').addEventListener('click', () => renderSharePreview(collectionId));
  document.querySelector('#addItemToCollection').addEventListener('click', () => openItemDialog(null, collectionId));
  document.querySelector('#itemSearch').addEventListener('input', paintDetailItems);
  document.querySelector('#groupFilter').addEventListener('change', paintDetailItems);
  paintDetailItems();
}

function paintDetailItems() {
  const query = document.querySelector('#itemSearch')?.value.trim() || '';
  const group = document.querySelector('#groupFilter')?.value || '全部';
  const list = itemsForCollection(currentCollectionId).filter((item) => {
    const matchQuery = !query || item.title.includes(query) || item.note.includes(query) || item.platform.includes(query);
    const matchGroup = group === '全部' || item.category === group;
    return matchQuery && matchGroup;
  });
  paintItems(document.querySelector('#itemList'), list, { showArchive: false });
}

function renderSharePreview(collectionId) {
  const collection = getCollection(collectionId);
  const all = itemsForCollection(collectionId);
  const publicItems = all.filter((item) => item.itemType !== 'attachment');
  const hiddenCount = all.length - publicItems.length;
  setHeader('公开分享预览', '这里模拟别人打开分享页时能看到的降级内容。');
  els.viewRoot.innerHTML = `
    <div class="detail-layout">
      <aside class="card hero-card">
        <h3>${escapeHtml(collection.title)}</h3>
        <p>${escapeHtml(collection.desc || '暂无简介')}</p>
        <div class="chips">
          <span class="chip">由我整理</span>
          <span class="chip">${publicItems.length} 条公开</span>
        </div>
        <div class="card-actions">
          <button class="secondary" id="backToDetail">返回详情</button>
          <button class="secondary">收藏合集</button>
        </div>
      </aside>
      <section id="shareList"></section>
    </div>
  `;
  document.querySelector('#backToDetail').addEventListener('click', () => renderCollectionDetail(collectionId));
  const root = document.querySelector('#shareList');
  root.innerHTML = publicItems.map(publicItemCard).join('') +
    (hiddenCount ? `<article class="card notice">有 ${hiddenCount} 个私密附件记录已隐藏。公开页不会展示截图、文件或大段原文。</article>` : '');
}

function renderInbox() {
  setHeader('收件箱', '先保存，后整理。没有选择合集的条目会在这里。');
  const inbox = state.items.filter((item) => !item.collectionId);
  els.viewRoot.innerHTML = `<div id="inboxList"></div>`;
  paintItems(document.querySelector('#inboxList'), inbox, { showArchive: true });
}

function renderAllItems() {
  setHeader('全部条目', '查看所有链接、来源记录和私密附件记录。');
  els.viewRoot.innerHTML = `
    <div class="toolbar">
      <input class="search" id="allSearch" placeholder="搜索标题、平台、备注" />
      <select id="typeFilter">
        <option value="all">全部类型</option>
        <option value="link">链接</option>
        <option value="source">来源记录</option>
        <option value="attachment">私密附件</option>
      </select>
    </div>
    <div id="allItemList"></div>
  `;
  document.querySelector('#allSearch').addEventListener('input', paintAllItems);
  document.querySelector('#typeFilter').addEventListener('change', paintAllItems);
  paintAllItems();
}

function paintAllItems() {
  const query = document.querySelector('#allSearch')?.value.trim() || '';
  const type = document.querySelector('#typeFilter')?.value || 'all';
  const list = state.items.filter((item) => {
    const matchQuery = !query || item.title.includes(query) || item.note.includes(query) || item.platform.includes(query);
    const matchType = type === 'all' || item.itemType === type;
    return matchQuery && matchType;
  });
  paintItems(document.querySelector('#allItemList'), list, { showArchive: true });
}

function renderSettings() {
  setHeader('数据', '导入、导出和清空本地数据。');
  els.viewRoot.innerHTML = `
    <div class="card">
      <h3>本地数据备份</h3>
      <p>数据保存在浏览器 localStorage。建议定期导出 JSON 文件，避免清理浏览器数据后丢失。</p>
      <div class="card-actions">
        <button class="primary" id="exportBtn">导出 JSON</button>
        <label class="secondary" style="display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 14px;border-radius:12px;cursor:pointer;">
          导入 JSON
          <input id="importFile" type="file" accept="application/json" style="display:none" />
        </label>
        <button class="danger" id="resetBtn">清空重置</button>
      </div>
    </div>
  `;
  document.querySelector('#exportBtn').addEventListener('click', exportData);
  document.querySelector('#importFile').addEventListener('change', importData);
  document.querySelector('#resetBtn').addEventListener('click', () => confirmDelete('确定清空所有本地数据并恢复示例数据吗？', () => {
    state = seedState();
    saveState();
    render();
  }));
}

function paintItems(root, list, options = {}) {
  if (!list.length) {
    root.innerHTML = `<div class="empty">这里还没有条目。</div>`;
    return;
  }
  root.innerHTML = list.map((item) => itemCard(item, options)).join('');
  root.querySelectorAll('[data-edit-item]').forEach((button) => {
    button.addEventListener('click', () => openItemDialog(button.dataset.editItem));
  });
  root.querySelectorAll('[data-delete-item]').forEach((button) => {
    button.addEventListener('click', () => confirmDelete('确定删除这个条目吗？', () => {
      state.items = state.items.filter((item) => item.id !== button.dataset.deleteItem);
      saveState();
      render();
    }));
  });
  root.querySelectorAll('[data-archive-item]').forEach((button) => {
    button.addEventListener('click', () => archiveItem(button.dataset.archiveItem));
  });
  root.querySelectorAll('[data-copy-url]').forEach((button) => {
    button.addEventListener('click', () => copyText(button.dataset.copyUrl));
  });
  root.querySelectorAll('[data-open-url]').forEach((button) => {
    button.addEventListener('click', () => {
      window.open(button.dataset.openUrl, '_blank', 'noreferrer');
    });
  });
}

function itemCard(item, options) {
  const collection = getCollection(item.collectionId);
  const urlBlock = item.itemType === 'link' && item.url
    ? `<div class="link-line">
        <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer" title="${escapeAttr(item.url)}">${escapeHtml(item.url)}</a>
        <button class="copy-mini" data-copy-url="${escapeAttr(item.url)}">复制</button>
      </div>`
    : '';
  return `
    <article class="card">
      <div class="item-row">
        <div class="mark ${itemTypeClass(item.itemType)}">${labels.itemType[item.itemType].slice(0, 1)}</div>
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.note || item.platform || '暂无备注')}</p>
          ${urlBlock}
          <div class="chips">
            <span class="chip ${item.itemType === 'attachment' ? 'green' : ''}">${labels.itemType[item.itemType]}</span>
            <span class="chip ${statusClass(item.status)}">${labels.status[item.status]}</span>
            ${collection ? `<span class="chip blue">${escapeHtml(collection.title)}</span>` : `<span class="chip warn">待归档</span>`}
            ${item.category ? `<span class="chip">${escapeHtml(item.category)}</span>` : ''}
            ${item.time ? `<span class="chip">${escapeHtml(item.time)}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          ${item.itemType === 'link' && item.url ? `<button class="secondary" data-open-url="${escapeAttr(item.url)}">打开链接</button>` : ''}
          ${options.showArchive ? `<button class="secondary" data-archive-item="${item.id}">归档</button>` : ''}
          <button class="ghost" data-edit-item="${item.id}">编辑</button>
          <button class="ghost" data-delete-item="${item.id}">删除</button>
        </div>
      </div>
    </article>
  `;
}

function publicItemCard(item) {
  const text = item.itemType === 'link'
    ? (item.url ? `打开原站：${item.url}` : '打开原站查看')
    : `来源：${item.platform || '未填写平台'}${item.author ? ` · ${item.author}` : ''}`;
  return `
    <article class="card">
      <div class="item-row">
        <div class="mark ${itemTypeClass(item.itemType)}">${labels.itemType[item.itemType].slice(0, 1)}</div>
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(text)}</p>
          <div class="chips">
            <span class="chip ${statusClass(item.status)}">${labels.status[item.status]}</span>
            ${item.category ? `<span class="chip">${escapeHtml(item.category)}</span>` : ''}
            ${item.time ? `<span class="chip">${escapeHtml(item.time)}</span>` : ''}
          </div>
        </div>
      </div>
    </article>
  `;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('已复制链接');
  } catch (error) {
    prompt('复制链接', value);
  }
}

function openCollectionDialog(id = '') {
  const collection = id ? getCollection(id) : null;
  document.querySelector('#collectionDialogTitle').textContent = collection ? '编辑合集' : '新建合集';
  document.querySelector('#collectionId').value = collection?.id || '';
  document.querySelector('#collectionTitle').value = collection?.title || '';
  document.querySelector('#collectionDesc').value = collection?.desc || '';
  document.querySelector('#collectionMode').value = collection?.mode || 'type';
  document.querySelector('#collectionVisibility').value = collection?.visibility || 'private';
  document.querySelector('#collectionGroups').value = collection?.groups?.join('、') || '舞台、采访、综艺';
  els.collectionDialog.showModal();
}

function saveCollectionFromDialog() {
  const title = document.querySelector('#collectionTitle').value.trim();
  if (!title) {
    toast('请填写合集标题');
    return;
  }
  const id = document.querySelector('#collectionId').value;
  const data = {
    title,
    desc: document.querySelector('#collectionDesc').value.trim(),
    mode: document.querySelector('#collectionMode').value,
    visibility: document.querySelector('#collectionVisibility').value,
    groups: splitList(document.querySelector('#collectionGroups').value),
    updatedAt: now(),
  };
  if (id) {
    state.collections = state.collections.map((item) => item.id === id ? { ...item, ...data } : item);
  } else {
    state.collections.unshift({ id: uid(), ...data, createdAt: now() });
  }
  saveState();
  els.collectionDialog.close();
  render();
}

function openItemDialog(id = '', defaultCollectionId = '') {
  const item = id ? getItem(id) : null;
  currentItemType = item?.itemType || 'link';
  document.querySelector('#itemDialogTitle').textContent = item ? '编辑条目' : '添加条目';
  document.querySelector('#itemId').value = item?.id || '';
  refreshCollectionSelect(item?.collectionId || defaultCollectionId || '');
  document.querySelector('#itemTitle').value = item?.title || '';
  document.querySelector('#itemUrl').value = item?.url || '';
  document.querySelector('#itemPlatform').value = item?.platform || '';
  document.querySelector('#itemAuthor').value = item?.author || '';
  document.querySelector('#itemCategory').value = item?.category || '';
  document.querySelector('#itemTime').value = item?.time || '';
  document.querySelector('#itemTags').value = item?.tags || '';
  document.querySelector('#itemStatus').value = item?.status || (currentItemType === 'attachment' ? 'privateOnly' : 'available');
  document.querySelector('#itemNote').value = item?.note || '';
  document.querySelectorAll('[data-item-type]').forEach((button) => {
    button.classList.toggle('active', button.dataset.itemType === currentItemType);
  });
  syncItemDialogForType();
  els.itemDialog.showModal();
}

function refreshCollectionSelect(selectedId) {
  const select = document.querySelector('#itemCollection');
  select.innerHTML = `<option value="">先放入收件箱</option>` +
    state.collections.map((collection) => `<option value="${collection.id}">${escapeHtml(collection.title)}</option>`).join('');
  select.value = selectedId || '';
}

function syncItemDialogForType() {
  document.querySelector('#urlField').style.display = currentItemType === 'link' ? 'grid' : 'none';
  const status = document.querySelector('#itemStatus');
  if (currentItemType === 'attachment') {
    status.value = 'privateOnly';
    status.disabled = true;
  } else {
    status.disabled = false;
    if (status.value === 'privateOnly') status.value = 'available';
  }
}

function saveItemFromDialog() {
  const title = document.querySelector('#itemTitle').value.trim();
  if (!title) {
    toast('请填写标题');
    return;
  }
  const id = document.querySelector('#itemId').value;
  const data = {
    collectionId: document.querySelector('#itemCollection').value,
    itemType: currentItemType,
    title,
    url: document.querySelector('#itemUrl').value.trim(),
    platform: document.querySelector('#itemPlatform').value.trim(),
    author: document.querySelector('#itemAuthor').value.trim(),
    category: document.querySelector('#itemCategory').value.trim(),
    time: document.querySelector('#itemTime').value.trim(),
    tags: document.querySelector('#itemTags').value.trim(),
    status: currentItemType === 'attachment' ? 'privateOnly' : document.querySelector('#itemStatus').value,
    note: document.querySelector('#itemNote').value.trim(),
    updatedAt: now(),
  };
  if (id) {
    state.items = state.items.map((item) => item.id === id ? { ...item, ...data } : item);
  } else {
    state.items.unshift({ id: uid(), ...data, createdAt: now() });
  }
  saveState();
  els.itemDialog.close();
  render();
}

function archiveItem(id) {
  const item = getItem(id);
  if (!item) return;
  if (!state.collections.length) {
    alert('请先创建合集');
    return;
  }
  const names = state.collections.map((collection, index) => `${index + 1}. ${collection.title}`).join('\n');
  const picked = prompt(`输入要归档到的合集编号：\n${names}`);
  const index = Number(picked) - 1;
  const collection = state.collections[index];
  if (!collection) return;
  item.collectionId = collection.id;
  item.updatedAt = now();
  saveState();
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `主题资料合集备份-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.collections) || !Array.isArray(data.items)) {
        throw new Error('Invalid backup');
      }
      state = data;
      saveState();
      render();
      alert('导入完成');
    } catch (error) {
      alert('导入失败：文件格式不正确');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function confirmDelete(text, callback) {
  document.querySelector('#confirmText').textContent = text;
  pendingConfirm = callback;
  els.confirmDialog.showModal();
}

function getCollection(id) {
  return state.collections.find((item) => item.id === id);
}

function getItem(id) {
  return state.items.find((item) => item.id === id);
}

function itemsForCollection(collectionId) {
  return state.items.filter((item) => item.collectionId === collectionId);
}

function splitList(value) {
  return value.split(/[、,，\s]+/).map((item) => item.trim()).filter(Boolean);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function toast(message) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 180);
  }, 1800);
}

function visibilityClass(value) {
  if (value === 'public') return '';
  if (value === 'unlisted') return 'blue';
  return 'muted';
}

function itemTypeClass(value) {
  if (value === 'link') return 'blue';
  if (value === 'source') return 'warn';
  return 'muted';
}

function statusClass(value) {
  if (value === 'available') return 'green';
  if (value === 'privateOnly') return 'green';
  if (['appOnly', 'deleted', 'maybeInvalid', 'unavailable'].includes(value)) return 'warn';
  return '';
}
