// ========================================
// PERSONAL BUDGET PLANNER
// ========================================

// Get HTML elements
const budgetForm = document.getElementById("budgetForm");
const budgetAmount = document.getElementById("budgetAmount");
const budgetProgress = document.getElementById("budgetProgress");
const budgetMessage = document.getElementById("budgetMessage");

const transactionForm = document.getElementById("transactionForm");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");

const totalIncomeElement = document.getElementById("totalIncome");
const totalExpensesElement = document.getElementById("totalExpenses");
const remainingBalanceElement = document.getElementById("remainingBalance");
const netBalanceElement = document.getElementById("netBalance");

const transactionList = document.getElementById("transactionList");
const categoryBreakdown = document.getElementById("categoryBreakdown");

const monthFilter = document.getElementById("monthFilter");
const typeFilter = document.getElementById("typeFilter");

const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

// ========================================
// LOCAL STORAGE
// ========================================

function loadData(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
    } catch (error) {
        console.error("Could not load saved data:", error);
        return fallback;
    }
}

let transactions = loadData("budgetTransactions", []);
let budgets = loadData("monthlyBudgets", {});

if (!Array.isArray(transactions)) {
    transactions = [];
}

if (
    !budgets ||
    typeof budgets !== "object" ||
    Array.isArray(budgets)
) {
    budgets = {};
}

function saveData() {
    try {
        localStorage.setItem(
            "budgetTransactions",
            JSON.stringify(transactions)
        );

        localStorage.setItem(
            "monthlyBudgets",
            JSON.stringify(budgets)
        );

        return true;
    } catch (error) {
        console.error("Could not save data:", error);
        alert("Unable to save data. Your browser storage may be full or disabled.");
        return false;
    }
}

// ========================================
// DATE AND CURRENCY HELPERS
// ========================================

function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
    return getLocalDate().slice(0, 7);
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function getSelectedMonth() {
    return monthFilter.value || getCurrentMonth();
}

function getMonthlyTransactions() {
    return transactions.filter(transaction =>
        transaction.date.startsWith(getSelectedMonth())
    );
}

// ========================================
// INITIAL SETTINGS
// ========================================

monthFilter.value = getCurrentMonth();
dateInput.value = getLocalDate();

// ========================================
// SET MONTHLY BUDGET
// ========================================

budgetForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const amount = Number(budgetAmount.value);

    if (
        budgetAmount.value.trim() === "" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 1000000000
    ) {
        alert("Please enter a valid budget.");
        return;
    }

    budgets[getSelectedMonth()] = amount;

    if (saveData()) {
        renderDashboard();
        alert("Monthly budget saved successfully!");
    }
});

// ========================================
// ADD TRANSACTION
// ========================================

transactionForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = Number(amountInput.value);
    const type = typeInput.value;
    const category = categoryInput.value;
    const date = dateInput.value;

    if (
        !description ||
        !date ||
        date > getLocalDate() &&
        date.length !== 10
    ) {
        alert("Please enter valid transaction details.");
        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1000000000
    ) {
        alert("Please enter a valid amount greater than zero.");
        return;
    }

    const transaction = {
        id: Date.now() + Math.random(),
        description,
        amount,
        type,
        category,
        date
    };

    transactions.push(transaction);

    if (saveData()) {
        monthFilter.value = date.slice(0, 7);
        typeFilter.value = "all";

        transactionForm.reset();
        dateInput.value = getLocalDate();

        renderDashboard();
    }
});

// ========================================
// UPDATE DASHBOARD
// ========================================

function renderDashboard() {
    const monthlyTransactions = getMonthlyTransactions();

    const income = monthlyTransactions
        .filter(transaction => transaction.type === "income")
        .reduce((total, transaction) => total + transaction.amount, 0);

    const expenses = monthlyTransactions
        .filter(transaction => transaction.type === "expense")
        .reduce((total, transaction) => total + transaction.amount, 0);

    const budget = Number(budgets[getSelectedMonth()]) || 0;

    const remainingBudget = budget - expenses;
    const netBalance = income - expenses;

    // Update summary cards
    totalIncomeElement.textContent = formatMoney(income);
    totalExpensesElement.textContent = formatMoney(expenses);
    remainingBalanceElement.textContent = formatMoney(remainingBudget);
    netBalanceElement.textContent = formatMoney(netBalance);

    // Color negative balances
    remainingBalanceElement.style.color =
        remainingBudget < 0 ? "#dc2626" : "#16a34a";

    netBalanceElement.style.color =
        netBalance < 0 ? "#dc2626" : "#16a34a";

    // Display selected month's budget
    budgetAmount.value = budgets[getSelectedMonth()] ?? "";

    // Update budget progress
    const percentage = budget > 0
        ? (expenses / budget) * 100
        : 0;

    budgetProgress.style.width =
        Math.min(percentage, 100) + "%";

    budgetProgress.style.background =
        percentage > 100 ? "#dc2626" : "#16a34a";

    if (budget === 0) {
        budgetMessage.textContent =
            "Set your monthly budget to track your spending.";
    } else if (expenses > budget) {
        budgetMessage.textContent =
            `Warning! You are ${formatMoney(expenses - budget)} over budget.`;
    } else {
        budgetMessage.textContent =
            `${formatMoney(remainingBudget)} remaining · ${percentage.toFixed(1)}% of budget used.`;
    }

    // Update other sections
    renderCategories(monthlyTransactions);
    renderTransactions(monthlyTransactions);
}

// ========================================
// SPENDING BY CATEGORY
// ========================================

function renderCategories(monthlyTransactions) {
    const expenses = monthlyTransactions.filter(
        transaction => transaction.type === "expense"
    );

    const categoryTotals = {};

    expenses.forEach(transaction => {
        categoryTotals[transaction.category] =
            (categoryTotals[transaction.category] || 0) +
            transaction.amount;
    });

    const totalExpenses = expenses.reduce(
        (total, transaction) => total + transaction.amount,
        0
    );

    const categories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) {
        categoryBreakdown.innerHTML =
            '<p class="empty-message">No expenses recorded yet.</p>';
        return;
    }

    categoryBreakdown.innerHTML = categories.map(
        ([category, amount]) => {
            const percentage = totalExpenses > 0
                ? (amount / totalExpenses) * 100
                : 0;

            return `
                <div class="category-item">
                    <div class="category-info">
                        <span>${escapeHTML(category)}</span>
                        <span>${formatMoney(amount)}</span>
                    </div>

                    <div class="category-progress">
                        <div style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }
    ).join("");
}

// ========================================
// TRANSACTION HISTORY
// ========================================

function renderTransactions(monthlyTransactions) {
    const filter = typeFilter.value;

    const filteredTransactions = monthlyTransactions
        .filter(transaction =>
            filter === "all" || transaction.type === filter
        )
        .sort((a, b) =>
            b.date.localeCompare(a.date) || b.id - a.id
        );

    if (filteredTransactions.length === 0) {
        transactionList.innerHTML =
            '<p class="empty-message">No matching transactions found.</p>';
        return;
    }

    transactionList.innerHTML = filteredTransactions.map(
        transaction => {
            const isIncome = transaction.type === "income";

            return `
                <div class="transaction">
                    <div class="transaction-info">
                        <h4>${escapeHTML(transaction.description)}</h4>
                        <p>
                            ${escapeHTML(transaction.date)}
                            · ${escapeHTML(transaction.category)}
                            · ${isIncome ? "Income" : "Expense"}
                        </p>
                    </div>

                    <div class="transaction-right">
                        <span class="transaction-amount ${isIncome ? "income-text" : "expense-text"
                }">
                            ${isIncome ? "+" : "-"}${formatMoney(transaction.amount)}
                        </span>

                        <button
                            type="button"
                            class="delete-btn"
                            data-delete-id="${transaction.id}"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }
    ).join("");
}

// ========================================
// PREVENT HTML INJECTION
// ========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const characters = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return characters[character];
    });
}

// ========================================
// DELETE A TRANSACTION
// ========================================

transactionList.addEventListener("click", function (event) {
    const button = event.target.closest("[data-delete-id]");

    if (!button) {
        return;
    }

    const id = Number(button.dataset.deleteId);

    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    const previousTransactions = transactions;

    transactions = transactions.filter(
        transaction => transaction.id !== id
    );

    if (!saveData()) {
        transactions = previousTransactions;
        return;
    }

    renderDashboard();
});

// ========================================
// FILTER BY MONTH AND TYPE
// ========================================

monthFilter.addEventListener("change", renderDashboard);
typeFilter.addEventListener("change", renderDashboard);

// ========================================
// EXPORT TRANSACTIONS TO CSV
// ========================================

exportBtn.addEventListener("click", function () {
    const monthlyTransactions = getMonthlyTransactions();

    if (monthlyTransactions.length === 0) {
        alert("No transactions available to export.");
        return;
    }

    const rows = [
        ["Date", "Description", "Type", "Category", "Amount"],
        ...monthlyTransactions.map(transaction => [
            transaction.date,
            transaction.description,
            transaction.type,
            transaction.category,
            transaction.amount
        ])
    ];

    const csv = rows.map(row =>
        row.map(value => {
            // Escape formula-leading characters in exported text fields.
            let text = String(value);

            if (
                typeof value === "string" &&
                /^[=+\-@\t\r]/.test(text)
            ) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `budget-${getSelectedMonth()}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
});

// ========================================
// CLEAR ALL DATA
// ========================================

clearBtn.addEventListener("click", function () {
    if (!confirm(
        "Are you sure? This will permanently delete all saved budgets and transactions."
    )) {
        return;
    }

    const previousTransactions = transactions;
    const previousBudgets = budgets;

    transactions = [];
    budgets = {};

    if (!saveData()) {
        transactions = previousTransactions;
        budgets = previousBudgets;
        return;
    }

    renderDashboard();

    alert("All budget records have been cleared.");
});

// ========================================
// INITIALIZE APPLICATION
// ========================================

renderDashboard();