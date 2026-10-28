'use strict';

/* ==========================================================
   Dompet Kuliah — logika aplikasi
   Data disimpan di localStorage agar tetap ada setelah refresh.
   ========================================================== */

const STORAGE_KEYS = {
  budgets: 'dompetKuliah.categoryBudgets.v1',
  expenses: 'dompetKuliah.expenses.v1',
};

const CATEGORIES = new Set([
  'Makanan',
  'Transportasi',
  'Pendidikan',
  'Hiburan',
  'Kebutuhan Harian',
  'Kesehatan',
  'Lainnya',
]);

const CATEGORY_ORDER = [...CATEGORIES];

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

const percentFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 1,
});

const state = {
  budgets: {},
  expenses: [],
  editingId: null,
};

const els = {
  monthLabel: document.getElementById('month-label'),
  budgetForm: document.getElementById('budget-form'),
  budgetCategory: document.getElementById('budget-category'),
  budgetInput: document.getElementById('budget-input'),
  budgetMessage: document.getElementById('budget-message'),
  budgetList: document.getElementById('budget-list'),
  budgetEmpty: document.getElementById('budget-empty'),
  budgetCount: document.getElementById('budget-count'),
  expenseForm: document.getElementById('expense-form'),
  expenseName: document.getElementById('expense-name'),
  expenseAmount: document.getElementById('expense-amount'),
  expenseCategory: document.getElementById('expense-category'),
  expenseMessage: document.getElementById('expense-message'),
  expenseList: document.getElementById('expense-list'),
  emptyState: document.getElementById('empty-state'),
  historyCount: document.getElementById('history-count'),
  clearButton: document.getElementById('clear-expenses'),
  categoryChart: document.getElementById('category-chart'),
  chartEmpty: document.getElementById('chart-empty'),
  chartSummary: document.getElementById('chart-summary'),
  chartTotal: document.getElementById('chart-total'),
};

const messageTimers = new WeakMap();

/* ---------- Utilitas ---------- */

function formatRupiah(value) {
  return rupiahFormatter.format(value);
}

function createId() {
  return `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setMessage(element, text, type = '') {
  element.textContent = text;
  element.classList.remove('is-error', 'is-success');
  if (type) {
    element.classList.add(`is-${type}`);
  }

  const existingTimer = messageTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Pesan sukses hilang sendiri; pesan error tetap sampai aksi berikutnya.
  if (text && type === 'success') {
    messageTimers.set(
      element,
      setTimeout(() => {
        element.textContent = '';
        element.classList.remove('is-success');
      }, 4500),
    );
  }
}

function isValidExpense(item) {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    CATEGORIES.has(item.category) &&
    Number.isFinite(item.createdAt)
  );
}

function readStoredBudgets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.budgets);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const budgets = {};
    for (const category of CATEGORY_ORDER) {
      const value = Number(parsed[category]);
      if (Number.isFinite(value) && value > 0) {
        budgets[category] = Math.round(value);
      }
    }
    return budgets;
  } catch (error) {
    console.warn('Batas anggaran kategori tidak dapat dibaca dari localStorage.', error);
    return {};
  }
}

function readStoredExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.expenses);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isValidExpense)
      .map((item) => ({
        id: item.id,
        name: item.name.trim().slice(0, 60),
        amount: Math.round(item.amount),
        category: item.category,
        createdAt: item.createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.warn('Riwayat pengeluaran tidak dapat dibaca dari localStorage.', error);
    return [];
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(state.budgets));
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(state.expenses));
    return true;
  } catch (error) {
    console.error('Gagal menyimpan data ke localStorage.', error);
    return false;
  }
}

/* ---------- Render ---------- */

function createBudgetCard(entry) {
  const card = document.createElement('article');
  card.className = 'budget-card';
  card.dataset.state = entry.isLow ? 'warning' : 'safe';

  const head = document.createElement('div');
  head.className = 'budget-card-head';

  const title = document.createElement('h4');
  title.className = 'budget-card-title';
  title.textContent = entry.category;

  const status = document.createElement('span');
  status.className = 'budget-card-status';
  if (entry.remaining < 0) {
    status.textContent = 'Lewat batas';
  } else if (entry.remaining === 0) {
    status.textContent = 'Habis';
  } else if (entry.isLow) {
    status.textContent = 'Hampir habis';
  } else {
    status.textContent = 'Aman';
  }

  head.append(title, status);

  const remaining = document.createElement('p');
  remaining.className = 'budget-card-remaining';
  remaining.textContent = formatRupiah(entry.remaining);

  const meta = document.createElement('p');
  meta.className = 'budget-card-meta';

  const spent = document.createElement('span');
  spent.textContent = `Terpakai ${formatRupiah(entry.spent)}`;

  const limit = document.createElement('span');
  limit.textContent = `Batas ${formatRupiah(entry.limit)}`;

  meta.append(spent, limit);

  const progress = document.createElement('div');
  progress.className = 'progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', `Pemakaian anggaran ${entry.category}`);
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  progress.setAttribute('aria-valuenow', String(Math.round(entry.barUsage)));
  progress.setAttribute(
    'aria-valuetext',
    `${Math.round(entry.usage)}% dari batas anggaran ${entry.category} terpakai`,
  );

  const fill = document.createElement('span');
  fill.className = 'progress-fill';
  fill.style.width = `${entry.barUsage}%`;
  progress.append(fill);

  card.append(head, remaining, meta, progress);
  return card;
}

function renderBudgets() {
  const spentByCategory = new Map();
  for (const expense of state.expenses) {
    spentByCategory.set(
      expense.category,
      (spentByCategory.get(expense.category) || 0) + expense.amount,
    );
  }

  const entries = CATEGORY_ORDER.filter((category) => state.budgets[category] > 0).map(
    (category) => {
      const limit = state.budgets[category];
      const spent = spentByCategory.get(category) || 0;
      const remaining = limit - spent;
      const usage = (spent / limit) * 100;

      return {
        category,
        limit,
        spent,
        remaining,
        usage,
        barUsage: Math.min(100, Math.max(0, usage)),
        isLow: remaining < limit * 0.2,
      };
    },
  );

  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    fragment.append(createBudgetCard(entry));
  }
  els.budgetList.replaceChildren(fragment);

  const hasBudgets = entries.length > 0;
  els.budgetList.hidden = !hasBudgets;
  els.budgetEmpty.hidden = hasBudgets;
  els.budgetCount.hidden = !hasBudgets;
  els.budgetCount.textContent = hasBudgets ? `${entries.length} kategori diatur` : '';
}

function createExpenseEditForm(expense) {
  const form = document.createElement('form');
  form.className = 'expense-edit-form';
  form.dataset.id = expense.id;
  form.noValidate = true;

  const top = document.createElement('div');
  top.className = 'expense-edit-top';

  const heading = document.createElement('p');
  heading.className = 'expense-edit-heading';
  heading.textContent = 'Edit pengeluaran';

  const time = document.createElement('time');
  time.className = 'expense-edit-date';
  const createdAt = new Date(expense.createdAt);
  time.dateTime = createdAt.toISOString();
  time.textContent = dateFormatter.format(createdAt);

  top.append(heading, time);

  const nameField = document.createElement('div');
  nameField.className = 'field';

  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = `edit-name-${expense.id}`;
  nameLabel.textContent = 'Nama barang / pengeluaran';

  const nameInput = document.createElement('input');
  nameInput.id = `edit-name-${expense.id}`;
  nameInput.name = 'name';
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.value = expense.name;
  nameInput.autocomplete = 'off';
  nameInput.required = true;

  nameField.append(nameLabel, nameInput);

  const grid = document.createElement('div');
  grid.className = 'expense-edit-grid';

  const amountField = document.createElement('div');
  amountField.className = 'field';

  const amountLabel = document.createElement('label');
  amountLabel.htmlFor = `edit-amount-${expense.id}`;
  amountLabel.textContent = 'Nominal (Rp)';

  const amountInput = document.createElement('input');
  amountInput.id = `edit-amount-${expense.id}`;
  amountInput.name = 'amount';
  amountInput.type = 'number';
  amountInput.inputMode = 'numeric';
  amountInput.min = '1';
  amountInput.step = '100';
  amountInput.value = String(expense.amount);
  amountInput.required = true;

  amountField.append(amountLabel, amountInput);

  const categoryField = document.createElement('div');
  categoryField.className = 'field';

  const categoryLabel = document.createElement('label');
  categoryLabel.htmlFor = `edit-category-${expense.id}`;
  categoryLabel.textContent = 'Kategori';

  const categorySelect = document.createElement('select');
  categorySelect.id = `edit-category-${expense.id}`;
  categorySelect.name = 'category';
  categorySelect.required = true;

  for (const category of CATEGORY_ORDER) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    option.selected = category === expense.category;
    categorySelect.append(option);
  }

  categoryField.append(categoryLabel, categorySelect);
  grid.append(amountField, categoryField);

  const message = document.createElement('p');
  message.className = 'form-message edit-message';
  message.setAttribute('role', 'alert');
  message.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'expense-edit-actions';

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'btn btn-primary';
  saveButton.textContent = 'Simpan perubahan';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn-ghost';
  cancelButton.dataset.action = 'cancel-edit';
  cancelButton.dataset.id = expense.id;
  cancelButton.textContent = 'Batal';
  cancelButton.setAttribute('aria-label', `Batalkan edit ${expense.name}`);

  actions.append(saveButton, cancelButton);
  form.append(top, nameField, grid, message, actions);

  return form;
}

function createExpenseItem(expense) {
  const item = document.createElement('li');
  item.className = 'expense-item';

  if (state.editingId === expense.id) {
    item.classList.add('expense-item-editing');
    item.append(createExpenseEditForm(expense));
    return item;
  }

  const main = document.createElement('div');
  main.className = 'expense-main';

  const name = document.createElement('p');
  name.className = 'expense-name';
  name.textContent = expense.name;

  const meta = document.createElement('p');
  meta.className = 'expense-meta';

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = expense.category;

  const time = document.createElement('time');
  const date = new Date(expense.createdAt);
  time.dateTime = date.toISOString();
  time.textContent = dateFormatter.format(date);

  meta.append(tag, time);
  main.append(name, meta);

  const side = document.createElement('div');
  side.className = 'expense-side';

  const amount = document.createElement('p');
  amount.className = 'expense-amount';
  amount.textContent = formatRupiah(expense.amount);

  const actions = document.createElement('div');
  actions.className = 'expense-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'btn-edit';
  editButton.dataset.action = 'edit';
  editButton.dataset.id = expense.id;
  editButton.textContent = 'Edit';
  editButton.setAttribute('aria-label', `Edit ${expense.name}`);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'btn-delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = expense.id;
  deleteButton.textContent = 'Hapus';
  deleteButton.setAttribute('aria-label', `Hapus ${expense.name}`);

  actions.append(editButton, deleteButton);
  side.append(amount, actions);
  item.append(main, side);

  return item;
}

function createChartRow(row) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-row';
  wrapper.dataset.category = row.category;
  wrapper.setAttribute('role', 'listitem');

  const head = document.createElement('div');
  head.className = 'chart-row-head';

  const label = document.createElement('span');
  label.className = 'chart-label';
  label.textContent = row.category;

  const figure = document.createElement('span');
  figure.className = 'chart-figure';

  const amount = document.createElement('strong');
  amount.textContent = formatRupiah(row.amount);

  const percent = document.createElement('span');
  percent.className = 'chart-percent';
  percent.textContent = `${percentFormatter.format(row.percent)}%`;

  figure.append(amount, percent);

  const track = document.createElement('div');
  track.className = 'chart-track';
  track.setAttribute('aria-hidden', 'true');

  const bar = document.createElement('div');
  bar.className = 'chart-bar';
  track.append(bar);

  head.append(label, figure);
  wrapper.append(head, track);

  // Lebar batang diatur lewat persentase CSS setelah elemen terpasang.
  requestAnimationFrame(() => {
    bar.style.width = `${row.percent}%`;
  });

  return wrapper;
}

function renderChart() {
  const totals = new Map();
  let grandTotal = 0;

  for (const expense of state.expenses) {
    totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount);
    grandTotal += expense.amount;
  }

  const rows = [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      percent: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    fragment.append(createChartRow(row));
  }
  els.categoryChart.replaceChildren(fragment);

  const hasData = rows.length > 0;
  els.categoryChart.hidden = !hasData;
  els.chartEmpty.hidden = hasData;
  els.chartTotal.hidden = !hasData;

  if (hasData) {
    els.chartSummary.textContent = `Proporsi dari total ${formatRupiah(
      grandTotal,
    )} pengeluaran.`;
    els.chartTotal.textContent = `Total ${formatRupiah(grandTotal)}`;
  } else {
    els.chartSummary.textContent = 'Belum ada pengeluaran untuk dihitung.';
    els.chartTotal.textContent = 'Rp 0';
  }
}

function renderExpenses() {
  const fragment = document.createDocumentFragment();
  for (const expense of state.expenses) {
    fragment.append(createExpenseItem(expense));
  }
  els.expenseList.replaceChildren(fragment);

  const hasExpenses = state.expenses.length > 0;
  els.emptyState.hidden = hasExpenses;
  els.clearButton.hidden = !hasExpenses;

  if (hasExpenses) {
    const total = state.expenses.reduce((sum, item) => sum + item.amount, 0);
    els.historyCount.textContent = `${state.expenses.length} pengeluaran • Total ${formatRupiah(
      total,
    )}`;
  } else {
    els.historyCount.textContent = 'Belum ada pengeluaran.';
  }
}

/* ---------- Aksi ---------- */

function handleBudgetSubmit(event) {
  event.preventDefault();

  const category = els.budgetCategory.value;
  const rawValue = els.budgetInput.value.trim();
  const value = Number(rawValue);

  if (!CATEGORIES.has(category)) {
    setMessage(els.budgetMessage, 'Pilih kategori untuk batas anggaran.', 'error');
    els.budgetCategory.focus();
    return;
  }

  if (!rawValue || !Number.isFinite(value) || value <= 0) {
    setMessage(
      els.budgetMessage,
      'Masukkan nominal batas anggaran lebih dari 0.',
      'error',
    );
    els.budgetInput.focus();
    return;
  }

  const previousBudgets = state.budgets;
  state.budgets = { ...state.budgets, [category]: Math.round(value) };

  if (!persistState()) {
    state.budgets = previousBudgets;
    setMessage(
      els.budgetMessage,
      'Gagal menyimpan batas anggaran. Periksa ruang penyimpanan browser.',
      'error',
    );
    return;
  }

  els.budgetInput.value = String(state.budgets[category]);
  renderBudgets();
  setMessage(
    els.budgetMessage,
    `Batas anggaran ${category} ${formatRupiah(state.budgets[category])} berhasil disimpan.`,
    'success',
  );
}

function handleBudgetCategoryChange() {
  const category = els.budgetCategory.value;
  if (!CATEGORIES.has(category)) return;

  const currentBudget = state.budgets[category];
  els.budgetInput.value = currentBudget ? String(currentBudget) : '';
}

function handleExpenseSubmit(event) {
  event.preventDefault();

  const name = els.expenseName.value.trim();
  const rawAmount = els.expenseAmount.value.trim();
  const amount = Number(rawAmount);
  const category = els.expenseCategory.value;

  if (!name) {
    setMessage(els.expenseMessage, 'Isi nama barang atau pengeluaran.', 'error');
    els.expenseName.focus();
    return;
  }

  if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
    setMessage(
      els.expenseMessage,
      'Masukkan nominal pengeluaran lebih dari 0.',
      'error',
    );
    els.expenseAmount.focus();
    return;
  }

  if (!CATEGORIES.has(category)) {
    setMessage(els.expenseMessage, 'Pilih kategori pengeluaran.', 'error');
    els.expenseCategory.focus();
    return;
  }

  const expense = {
    id: createId(),
    name: name.slice(0, 60),
    amount: Math.round(amount),
    category,
    createdAt: new Date().getTime(),
  };

  const previousExpenses = state.expenses;
  state.expenses = [expense, ...state.expenses];

  if (!persistState()) {
    state.expenses = previousExpenses;
    setMessage(
      els.expenseMessage,
      'Gagal menyimpan pengeluaran. Periksa ruang penyimpanan browser.',
      'error',
    );
    return;
  }

  renderExpenses();
  renderBudgets();
  renderChart();
  els.expenseForm.reset();
  setMessage(
    els.expenseMessage,
    `${expense.name} (${formatRupiah(expense.amount)}) ditambahkan.`,
    'success',
  );
  els.expenseName.focus();
}

function focusEditButton(id) {
  const button = [...els.expenseList.querySelectorAll('button[data-action="edit"]')].find(
    (item) => item.dataset.id === id,
  );
  if (button) button.focus();
}

function handleExpenseListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const expense = state.expenses.find((item) => item.id === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === 'edit') {
    state.editingId = expense.id;
    renderExpenses();

    const form = [...els.expenseList.querySelectorAll('.expense-edit-form')].find(
      (item) => item.dataset.id === expense.id,
    );
    form?.querySelector('input[name="name"]')?.focus();
    return;
  }

  if (button.dataset.action === 'cancel-edit') {
    state.editingId = null;
    renderExpenses();
    focusEditButton(expense.id);
    return;
  }

  if (button.dataset.action !== 'delete') return;

  if (!window.confirm(`Hapus "${expense.name}" dari riwayat?`)) return;

  const previousExpenses = state.expenses;
  state.expenses = state.expenses.filter((item) => item.id !== expense.id);

  if (!persistState()) {
    state.expenses = previousExpenses;
    setMessage(
      els.expenseMessage,
      'Gagal menghapus pengeluaran. Periksa ruang penyimpanan browser.',
      'error',
    );
    return;
  }

  if (state.editingId === expense.id) {
    state.editingId = null;
  }

  renderExpenses();
  renderBudgets();
  renderChart();
  setMessage(
    els.expenseMessage,
    `${expense.name} dihapus dari riwayat.`,
    'success',
  );
}

function handleExpenseEditSubmit(event) {
  const form = event.target.closest('.expense-edit-form');
  if (!form) return;

  event.preventDefault();

  const expense = state.expenses.find((item) => item.id === form.dataset.id);
  if (!expense) {
    state.editingId = null;
    renderExpenses();
    return;
  }

  const nameInput = form.querySelector('input[name="name"]');
  const amountInput = form.querySelector('input[name="amount"]');
  const categorySelect = form.querySelector('select[name="category"]');
  const message = form.querySelector('.edit-message');

  const name = nameInput.value.trim();
  const rawAmount = amountInput.value.trim();
  const amount = Number(rawAmount);
  const category = categorySelect.value;

  if (!name) {
    setMessage(message, 'Nama pengeluaran tidak boleh kosong.', 'error');
    nameInput.focus();
    return;
  }

  if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
    setMessage(message, 'Masukkan nominal pengeluaran lebih dari 0.', 'error');
    amountInput.focus();
    return;
  }

  if (!CATEGORIES.has(category)) {
    setMessage(message, 'Pilih kategori pengeluaran.', 'error');
    categorySelect.focus();
    return;
  }

  const updatedExpense = {
    ...expense,
    name: name.slice(0, 60),
    amount: Math.round(amount),
    category,
  };

  const previousExpenses = state.expenses;
  state.expenses = state.expenses.map((item) =>
    item.id === updatedExpense.id ? updatedExpense : item,
  );

  if (!persistState()) {
    state.expenses = previousExpenses;
    setMessage(
      message,
      'Gagal menyimpan perubahan. Periksa ruang penyimpanan browser.',
      'error',
    );
    return;
  }

  state.editingId = null;
  renderExpenses();
  renderBudgets();
  renderChart();
  setMessage(
    els.expenseMessage,
    `Perubahan "${updatedExpense.name}" berhasil disimpan.`,
    'success',
  );
  focusEditButton(updatedExpense.id);
}

function handleClearExpenses() {
  if (state.expenses.length === 0) return;

  if (!window.confirm('Hapus semua riwayat pengeluaran? Tindakan ini tidak bisa dibatalkan.')) {
    return;
  }

  const previousExpenses = state.expenses;
  state.expenses = [];

  if (!persistState()) {
    state.expenses = previousExpenses;
    setMessage(
      els.expenseMessage,
      'Gagal menghapus riwayat. Periksa ruang penyimpanan browser.',
      'error',
    );
    return;
  }

  state.editingId = null;
  renderExpenses();
  renderBudgets();
  renderChart();
  setMessage(els.expenseMessage, 'Semua riwayat pengeluaran dihapus.', 'success');
}

/* ---------- Inisialisasi ---------- */

function init() {
  state.budgets = readStoredBudgets();
  state.expenses = readStoredExpenses();

  els.monthLabel.textContent = capitalize(monthFormatter.format(new Date()));

  renderBudgets();
  renderExpenses();
  renderChart();

  els.budgetForm.addEventListener('submit', handleBudgetSubmit);
  els.budgetCategory.addEventListener('change', handleBudgetCategoryChange);
  els.expenseForm.addEventListener('submit', handleExpenseSubmit);
  els.expenseList.addEventListener('click', handleExpenseListClick);
  els.expenseList.addEventListener('submit', handleExpenseEditSubmit);
  els.clearButton.addEventListener('click', handleClearExpenses);
}

init();
