"use strict";

const STORAGE_KEY = "smartLibrary.books.v1";
const AVAILABLE = "DISPONIBLE";
const BORROWED = "EMPRUNTE";

const bookForm = document.querySelector("#book-form");
const bookFields = document.querySelector("#book-fields");
const titleInput = document.querySelector("#title");
const authorInput = document.querySelector("#author");
const categoryInput = document.querySelector("#category");
const isbnInput = document.querySelector("#isbn");
const searchInput = document.querySelector("#search-input");
const statusFilter = document.querySelector("#status-filter");
const categoryFilter = document.querySelector("#category-filter");
const sortOrder = document.querySelector("#sort-order");
const clearFiltersButton = document.querySelector("#clear-filters");
const booksList = document.querySelector("#books-list");
const resultsCount = document.querySelector("#results-count");
const totalCount = document.querySelector("#total-count");
const availableCount = document.querySelector("#available-count");
const borrowedCount = document.querySelector("#borrowed-count");
const storageError = document.querySelector("#storage-error");
const notice = document.querySelector("#notice");
const loanDialog = document.querySelector("#loan-dialog");
const loanForm = document.querySelector("#loan-form");
const loanBookTitle = document.querySelector("#loan-book-title");
const borrowerInput = document.querySelector("#borrower");
const dueDateInput = document.querySelector("#due-date");

let books = [];
let storageReady = true;
let loanBookId = null;

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!isValidDate(value)) {
    return "—";
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("fr-FR");
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

function normalizeIsbn(value) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = isbn.split("").reduce((total, character, index) => {
      const digit = character === "X" ? 10 : Number(character);
      return total + digit * (10 - index);
    }, 0);
    return sum % 11 === 0;
  }

  if (/^\d{13}$/.test(isbn)) {
    const sum = isbn.slice(0, 12).split("").reduce((total, character, index) => {
      return total + Number(character) * (index % 2 === 0 ? 1 : 3);
    }, 0);
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === Number(isbn[12]);
  }

  return false;
}

function isValidBook(book) {
  if (!book || typeof book !== "object" || Array.isArray(book)) {
    return false;
  }

  const hasText = (value) => typeof value === "string" && value.trim().length > 0;
  const validNullableDate = (value) => value === null || isValidDate(value);

  if (!hasText(book.id)
    || !hasText(book.title)
    || !hasText(book.author)
    || !hasText(book.category)
    || !isValidDate(book.addedAt)
    || ![AVAILABLE, BORROWED].includes(book.status)
    || !(book.isbn === null || (typeof book.isbn === "string" && isValidIsbn(book.isbn)))
    || !(book.borrower === null || typeof book.borrower === "string")
    || !validNullableDate(book.dueDate)
    || !validNullableDate(book.returnedAt)) {
    return false;
  }

  if (book.status === BORROWED) {
    return hasText(book.borrower) && isValidDate(book.dueDate) && book.returnedAt === null;
  }

  if (book.returnedAt !== null) {
    return hasText(book.borrower) && isValidDate(book.dueDate);
  }

  return book.borrower === null && book.dueDate === null;
}

function isValidCollection(value) {
  if (!Array.isArray(value) || !value.every(isValidBook)) {
    return false;
  }

  const ids = new Set();
  const isbns = new Set();

  for (const book of value) {
    if (ids.has(book.id)) {
      return false;
    }
    ids.add(book.id);

    if (book.isbn) {
      const normalizedIsbn = normalizeIsbn(book.isbn);
      if (isbns.has(normalizedIsbn)) {
        return false;
      }
      isbns.add(normalizedIsbn);
    }
  }

  return true;
}

function loadBooks() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (storedValue === null) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);
    if (!isValidCollection(parsedValue)) {
      throw new Error("Les données enregistrées ne respectent pas le format attendu.");
    }
    return parsedValue;
  } catch (error) {
    storageReady = false;
    showStorageError(
      "Impossible de charger la bibliothèque depuis ce navigateur. Les données existantes ne seront pas écrasées. Vérifiez le stockage local puis rechargez la page."
    );
    return [];
  }
}

function showStorageError(message) {
  storageError.textContent = message;
  storageError.hidden = false;
}

function clearStorageError() {
  storageError.textContent = "";
  storageError.hidden = true;
}

function showNotice(message) {
  notice.textContent = message;
}

function persistBooks(nextBooks, successMessage) {
  if (!storageReady) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextBooks));
  } catch (error) {
    showStorageError(
      "La sauvegarde a échoué. Vérifiez l'espace disponible et les paramètres de stockage du navigateur; vos changements n'ont pas été appliqués."
    );
    return false;
  }

  books = nextBooks;
  clearStorageError();
  render();
  showNotice(successMessage);
  return true;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createDetail(label, value) {
  const wrapper = createElement("div", "book-detail");
  wrapper.append(
    createElement("dt", "", label),
    createElement("dd", "", value)
  );
  return wrapper;
}

function createActionButton(label, action, className, bookId) {
  const button = createElement("button", `button ${className}`, label);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.bookId = bookId;
  return button;
}

function createBookCard(book) {
  const card = createElement("article", "book-card");
  const header = createElement("div", "book-card-header");
  const title = createElement("h3", "book-title", book.title);
  const isAvailable = book.status === AVAILABLE;
  const badge = createElement(
    "span",
    `status-badge ${isAvailable ? "status-available" : "status-borrowed"}`
  );
  badge.setAttribute("aria-label", `Statut : ${isAvailable ? "disponible" : "emprunté"}`);
  badge.append(
    createElement("span", "status-badge-icon", isAvailable ? "✓" : "↗"),
    createElement("span", "", isAvailable ? "DISPONIBLE" : "EMPRUNTÉ")
  );
  header.append(title, badge);
  card.append(header, createElement("p", "book-author", `par ${book.author}`));
  card.append(createElement("span", "book-category", book.category));

  const details = createElement("dl", "book-details");
  details.append(
    createDetail("Ajouté le", formatDate(book.addedAt)),
    createDetail("ISBN", book.isbn || "Non renseigné")
  );

  if (book.status === BORROWED || book.borrower) {
    details.append(
      createDetail("Emprunteur", book.borrower || "—"),
      createDetail("Retour prévu", formatDate(book.dueDate))
    );
    if (book.returnedAt) {
      details.append(createDetail("Retourné le", formatDate(book.returnedAt)));
    }
  }
  card.append(details);

  const actions = createElement("div", "book-actions");
  if (book.status === AVAILABLE) {
    actions.append(
      createActionButton("Emprunter", "borrow", "button-action", book.id)
    );
  } else {
    actions.append(
      createActionButton("Enregistrer le retour", "return", "button-return", book.id)
    );
  }

  const deleteButton = createActionButton("Supprimer", "delete", "button-delete", book.id);
  deleteButton.setAttribute("aria-label", `Supprimer ${book.title}`);
  actions.append(deleteButton);
  card.append(actions);
  return card;
}

function getFilteredBooks() {
  const query = normalizeText(searchInput.value);
  const selectedStatus = statusFilter.value;
  const selectedCategory = categoryFilter.value;
  const normalizedCategory = normalizeText(selectedCategory);

  const filteredBooks = books.filter((book) => {
    const matchesSearch = !query
      || normalizeText(book.title).includes(query)
      || normalizeText(book.author).includes(query);
    const matchesStatus = selectedStatus === "TOUS" || book.status === selectedStatus;
    const matchesCategory = !selectedCategory
      || normalizeText(book.category) === normalizedCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  filteredBooks.sort((first, second) => {
    if (sortOrder.value === "title") {
      return first.title.localeCompare(second.title, "fr", { sensitivity: "base" });
    }

    const dateOrder = first.addedAt.localeCompare(second.addedAt);
    if (dateOrder !== 0) {
      return sortOrder.value === "oldest" ? dateOrder : -dateOrder;
    }
    return first.title.localeCompare(second.title, "fr", { sensitivity: "base" });
  });

  return filteredBooks;
}

function updateCategoryOptions() {
  const selectedValue = categoryFilter.value;
  const categoriesByKey = new Map();

  for (const book of books) {
    const key = normalizeText(book.category);
    if (!categoriesByKey.has(key)) {
      categoriesByKey.set(key, book.category);
    }
  }

  const categories = [...categoriesByKey.values()].sort((first, second) => {
    return first.localeCompare(second, "fr", { sensitivity: "base" });
  });

  categoryFilter.replaceChildren(new Option("Toutes les catégories", ""));
  for (const category of categories) {
    categoryFilter.add(new Option(category, category));
  }

  const selectionExists = categories.some((category) => normalizeText(category) === normalizeText(selectedValue));
  categoryFilter.value = selectionExists ? selectedValue : "";
}

function renderEmptyState() {
  const isInitialEmpty = books.length === 0;
  const hasSearch = searchInput.value.trim().length > 0;
  const hasFilters = statusFilter.value !== "TOUS" || categoryFilter.value !== "";
  const emptyState = createElement("div", "empty-state");
  emptyState.append(createElement("div", "empty-icon", isInitialEmpty ? "▤" : "⌕"));
  emptyState.append(createElement(
    "h3",
    "",
    isInitialEmpty
      ? "Votre collection commence ici"
      : hasSearch
        ? "Aucun résultat pour cette recherche"
        : "Aucun livre ne correspond aux filtres"
  ));
  emptyState.append(createElement(
    "p",
    "",
    isInitialEmpty
      ? "Ajoutez votre premier livre pour commencer à organiser votre bibliothèque."
      : hasSearch && hasFilters
        ? `Aucun livre ne correspond à « ${searchInput.value.trim()} » et aux filtres sélectionnés.`
        : hasSearch
          ? `Aucun livre ne correspond à « ${searchInput.value.trim()} ». Vérifiez l'orthographe ou essayez un autre terme.`
          : "Essayez de modifier ou d'effacer vos filtres pour afficher des livres."
  ));

  if (isInitialEmpty) {
    const addButton = createElement("button", "button button-primary", "Ajouter un livre");
    addButton.type = "button";
    addButton.addEventListener("click", () => titleInput.focus());
    emptyState.append(addButton);
  } else {
    const resetButton = createElement("button", "button button-secondary", "Effacer la recherche et les filtres");
    resetButton.type = "button";
    resetButton.addEventListener("click", clearFilters);
    emptyState.append(resetButton);
  }

  booksList.append(emptyState);
}

function render() {
  updateCategoryOptions();

  if (!storageReady) {
    totalCount.textContent = "—";
    availableCount.textContent = "—";
    borrowedCount.textContent = "—";
    resultsCount.textContent = "Indisponible";
    booksList.replaceChildren();
    booksList.append(createElement(
      "div",
      "empty-state",
      "La collection ne peut pas être affichée tant que le stockage local est inaccessible."
    ));
    bookFields.disabled = true;
    return;
  }

  bookFields.disabled = false;
  totalCount.textContent = String(books.length);
  availableCount.textContent = String(books.filter((book) => book.status === AVAILABLE).length);
  borrowedCount.textContent = String(books.filter((book) => book.status === BORROWED).length);

  const visibleBooks = getFilteredBooks();
  resultsCount.textContent = `${visibleBooks.length} ${visibleBooks.length > 1 ? "livres" : "livre"}`;
  booksList.replaceChildren();

  if (visibleBooks.length === 0) {
    renderEmptyState();
    return;
  }

  for (const book of visibleBooks) {
    booksList.append(createBookCard(book));
  }
}

function clearFilters() {
  searchInput.value = "";
  statusFilter.value = "TOUS";
  categoryFilter.value = "";
  render();
  searchInput.focus();
}

function clearCustomValidity(event) {
  if (event.target instanceof HTMLInputElement) {
    event.target.setCustomValidity("");
  }
}

function validateBookForm() {
  const requiredInputs = [titleInput, authorInput, categoryInput];
  for (const input of requiredInputs) {
    input.setCustomValidity(input.value.trim() ? "" : "Ce champ est obligatoire.");
  }

  const isbnValue = isbnInput.value.trim();
  if (!isbnValue) {
    isbnInput.setCustomValidity("");
  } else if (!isValidIsbn(isbnValue)) {
    isbnInput.setCustomValidity("Saisissez un ISBN-10 ou ISBN-13 valide.");
  } else {
    const normalizedIsbn = normalizeIsbn(isbnValue);
    const duplicate = books.some((book) => book.isbn && normalizeIsbn(book.isbn) === normalizedIsbn);
    isbnInput.setCustomValidity(duplicate ? "Cet ISBN est déjà utilisé dans votre collection." : "");
  }

  return bookForm.reportValidity();
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

bookForm.addEventListener("input", clearCustomValidity);
bookForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateBookForm()) {
    return;
  }

  const isbnValue = isbnInput.value.trim();
  const newBook = {
    id: generateId(),
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    isbn: isbnValue || null,
    category: categoryInput.value.trim(),
    addedAt: todayString(),
    status: AVAILABLE,
    borrower: null,
    dueDate: null,
    returnedAt: null
  };

  if (persistBooks([...books, newBook], `« ${newBook.title} » a été ajouté à votre collection.`)) {
    bookForm.reset();
    titleInput.focus();
  }
});

function openLoanDialog(book) {
  loanBookId = book.id;
  loanForm.reset();
  loanBookTitle.textContent = book.title;
  dueDateInput.min = todayString();
  loanDialog.showModal();
  borrowerInput.focus();
}

loanForm.addEventListener("input", clearCustomValidity);
loanForm.addEventListener("submit", (event) => {
  event.preventDefault();

  borrowerInput.setCustomValidity(
    borrowerInput.value.trim() ? "" : "Saisissez le nom de l'emprunteur."
  );
  dueDateInput.setCustomValidity(
    isValidDate(dueDateInput.value) && dueDateInput.value >= todayString()
      ? ""
      : "Choisissez une date de retour prévue aujourd'hui ou plus tard."
  );

  if (!loanForm.reportValidity()) {
    return;
  }

  const book = books.find((item) => item.id === loanBookId);
  if (!book || book.status !== AVAILABLE) {
    showNotice("Ce livre n'est plus disponible pour l'emprunt.");
    loanDialog.close();
    return;
  }

  const updatedBooks = books.map((item) => item.id === book.id
    ? {
      ...item,
      status: BORROWED,
      borrower: borrowerInput.value.trim(),
      dueDate: dueDateInput.value,
      returnedAt: null
    }
    : item);

  if (persistBooks(updatedBooks, `L'emprunt de « ${book.title} » a été enregistré.`)) {
    loanDialog.close();
  }
});

function closeLoanDialog() {
  loanDialog.close();
}

document.querySelector("#loan-close").addEventListener("click", closeLoanDialog);
document.querySelector("#loan-cancel").addEventListener("click", closeLoanDialog);
loanDialog.addEventListener("close", () => {
  loanBookId = null;
});

booksList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !booksList.contains(button)) {
    return;
  }

  const book = books.find((item) => item.id === button.dataset.bookId);
  if (!book) {
    return;
  }

  if (button.dataset.action === "borrow") {
    if (book.status !== AVAILABLE) {
      showNotice("Ce livre est déjà emprunté.");
      return;
    }
    openLoanDialog(book);
    return;
  }

  if (button.dataset.action === "return") {
    if (book.status !== BORROWED) {
      showNotice("Ce livre est déjà disponible.");
      return;
    }
    const updatedBooks = books.map((item) => item.id === book.id
      ? { ...item, status: AVAILABLE, returnedAt: todayString() }
      : item);
    persistBooks(updatedBooks, `Le retour de « ${book.title} » a été enregistré.`);
    return;
  }

  if (button.dataset.action === "delete") {
    const borrowedWarning = book.status === BORROWED
      ? " Ce livre est emprunté; ses informations de prêt seront également supprimées."
      : "";
    const confirmed = window.confirm(`Supprimer « ${book.title} » ?${borrowedWarning}`);
    if (!confirmed) {
      return;
    }

    const updatedBooks = books.filter((item) => item.id !== book.id);
    persistBooks(updatedBooks, `« ${book.title} » a été supprimé de votre collection.`);
  }
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
categoryFilter.addEventListener("change", render);
sortOrder.addEventListener("change", render);
clearFiltersButton.addEventListener("click", clearFilters);

books = loadBooks();
render();