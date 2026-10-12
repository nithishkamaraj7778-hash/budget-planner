// ========================================
// PERSONAL BUDGET PLANNER
// ========================================

// Get HTML elements
const budgetForm = document.getElementById("budgetForm");
const budgetAmount = document.getElementById("budgetAmount");
const budgetProgress = document.getElementById("budgetProgress");
const budgetMessage = document.getElementById("budgetMessage");
const dailyLimitForm = document.getElementById("dailyLimitForm");
const dailyLimitAmount = document.getElementById("dailyLimitAmount");
const dailyLimitStatus = document.getElementById("dailyLimitStatus");
const dailyAlertPopup = document.getElementById("dailyAlertPopup");
const dailyAlertMessage = document.getElementById("dailyAlertMessage");
const dismissDailyAlertButton = document.getElementById("dismissDailyAlert");

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
const financeAssistant = document.getElementById("financeAssistant");
const assistantToggle = document.getElementById("assistantToggle");
const closeAssistantButton = document.getElementById("closeAssistant");
const assistantForm = document.getElementById("assistantForm");
const assistantInput = document.getElementById("assistantInput");
const assistantMessages = document.getElementById("assistantMessages");

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
const savedDailyLimit = loadData("dailySpendingLimit", 0);
let dailySpendingLimit =
    typeof savedDailyLimit === "number" &&
    Number.isFinite(savedDailyLimit) &&
    savedDailyLimit >= 0 &&
    savedDailyLimit <= 1000000000
        ? savedDailyLimit
        : 0;

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

        localStorage.setItem(
            "dailySpendingLimit",
            JSON.stringify(dailySpendingLimit)
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
// BUDGET ASSISTANT
// ========================================

let pendingAssistantAction = null;
let assistantActionId = 0;

function addAssistantMessage(message, sender = "bot", action = null) {
    const wrapper = document.createElement("div");
    wrapper.className = `assistant-message assistant-message-${sender}`;

    const text = document.createElement("p");
    text.textContent = message;
    wrapper.appendChild(text);

    if (action) {
        assistantMessages.querySelectorAll("[data-assistant-choice]").forEach(button => {
            button.disabled = true;
        });
        action.id = ++assistantActionId;
        const actions = document.createElement("div");
        actions.className = "assistant-message-actions";

        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "assistant-confirm";
        confirmButton.dataset.assistantChoice = "confirm";
        confirmButton.dataset.assistantId = String(action.id);
        confirmButton.textContent = "Confirm";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "assistant-cancel";
        cancelButton.dataset.assistantChoice = "cancel";
        cancelButton.dataset.assistantId = String(action.id);
        cancelButton.textContent = "Cancel";

        actions.append(confirmButton, cancelButton);
        wrapper.appendChild(actions);
        pendingAssistantAction = action;
    }

    assistantMessages.appendChild(wrapper);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

function getAssistantCategory(message, type) {
    const categories = Array.from(categoryInput.options)
        .map(option => option.value)
        .filter(category => type !== "income" || ["Salary", "Freelance", "Allowance", "Other"].includes(category));
    const normalizedMessage = message.toLowerCase();

    const category = categories.find(value =>
        new RegExp(`\\b${value.toLowerCase()}\\b`).test(normalizedMessage)
    );

    if (category) {
        return category;
    }

    const aliases = {
        groceries: "Food",
        grocery: "Food",
        coffee: "Food",
        lunch: "Food",
        dinner: "Food",
        breakfast: "Food",
        fuel: "Transport",
        taxi: "Transport",
        cab: "Transport",
        rent: "Housing",
        utilities: "Bills",
        medical: "Health",
        movie: "Entertainment",
        bonus: "Salary"
    };

    const alias = Object.entries(aliases).find(([word]) =>
        new RegExp(`\\b${word}\\b`).test(normalizedMessage)
    );

    return alias?.[1] ?? (type === "income" ? "Salary" : "Other");
}

function formatAssistantDate(date) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(`${date}T00:00:00`));
}

function getAssistantTransactionDraft(message) {
    const amountMatch = message.match(/(?:₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/);

    if (!amountMatch) {
        return null;
    }

    const amount = Number(amountMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
        return null;
    }

    const type = /\b(income|earned|received|salary|paycheck)\b/i.test(message)
        ? "income"
        : "expense";
    const category = getAssistantCategory(message, type);
    const descriptionMatch = message.match(/\b(?:on|for|from)\s+(.+?)(?:\s+(?:today|yesterday))?$/i);
    const description = descriptionMatch
        ? descriptionMatch[1].replace(/[.!?]+$/, "").trim()
        : category;

    return {
        amount,
        category,
        date: getLocalDate(),
        description: description || category,
        type
    };
}

function getAssistantSummary() {
    const monthlyTransactions = getMonthlyTransactions();
    const income = monthlyTransactions
        .filter(transaction => transaction.type === "income")
        .reduce((total, transaction) => total + transaction.amount, 0);
    const expenses = monthlyTransactions
        .filter(transaction => transaction.type === "expense")
        .reduce((total, transaction) => total + transaction.amount, 0);
    const budget = Number(budgets[getSelectedMonth()]) || 0;
    const todayExpenses = transactions
        .filter(transaction =>
            transaction.type === "expense" &&
            transaction.date === getLocalDate()
        )
        .reduce((total, transaction) => total + transaction.amount, 0);

    return `For ${getSelectedMonth()}: income ${formatMoney(income)}, expenses ${formatMoney(expenses)}, and net balance ${formatMoney(income - expenses)}.${budget > 0 ? ` You have ${formatMoney(budget - expenses)} left in your budget.` : " No monthly budget is set yet."} Today's spending is ${formatMoney(todayExpenses)}.`;
}

function handleAssistantMessage(message) {
    const normalizedMessage = message.toLowerCase();

    if (/^(help|what can you do|\?)\b/.test(normalizedMessage)) {
        addAssistantMessage("Try “spent 250 on lunch”, “received 50000 salary”, “set budget to 30000”, “set daily alert to 5000”, “show my summary”, “how much did I spend today?”, or “show recent transactions”. I’ll ask before saving entries or changing your budget.");
        return;
    }

    const dailyLimitMatch = normalizedMessage.match(
        /\b(?:set|change|update)\s+(?:my\s+)?(?:daily\s+)?(?:spending\s+)?(?:alert|limit)\b/
    );
    if (dailyLimitMatch) {
        const amountMatch = message.match(/(?:₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/);
        const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : NaN;

        if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) {
            addAssistantMessage("Tell me the daily limit amount, or use ₹0 to turn the alert off. For example: “set daily alert to 5000”.");
            return;
        }

        pendingAssistantAction = { amount, type: "daily-limit" };
        addAssistantMessage(
            amount === 0
                ? "Turn off your daily spending alert?"
                : `Set your daily spending alert to ${formatMoney(amount)}?`,
            "bot",
            pendingAssistantAction
        );
        return;
    }

    const budgetMatch = normalizedMessage.match(
        /\b(?:set|change|update)\s+(?:(?:my|monthly)\s+)?(?:monthly\s+)?budget\b/
    );
    if (budgetMatch) {
        const amountMatch = message.match(/(?:₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/);
        const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : NaN;

        if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) {
            addAssistantMessage("Tell me the amount to set, for example: “set budget to 30000”.");
            return;
        }

        pendingAssistantAction = { amount, month: getSelectedMonth(), type: "budget" };
        addAssistantMessage(
            `Set your budget for ${getSelectedMonth()} to ${formatMoney(amount)}?`,
            "bot",
            pendingAssistantAction
        );
        return;
    }

    if (/\b(recent|latest|last transactions|transaction history)\b/.test(normalizedMessage)) {
        const recent = getMonthlyTransactions()
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
            .slice(0, 5);

        if (recent.length === 0) {
            addAssistantMessage(`There are no transactions recorded for ${getSelectedMonth()}.`);
            return;
        }

        addAssistantMessage(`Your latest ${recent.length} transaction${recent.length === 1 ? "" : "s"} for ${getSelectedMonth()}: ${recent.map(transaction => `${transaction.description} (${transaction.type === "income" ? "+" : "-"}${formatMoney(transaction.amount)}, ${formatAssistantDate(transaction.date)})`).join("; ")}.`);
        return;
    }

    if (/\b(category|categories|breakdown)\b/.test(normalizedMessage)) {
        const totals = {};
        getMonthlyTransactions()
            .filter(transaction => transaction.type === "expense")
            .forEach(transaction => {
                totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
            });
        const categories = Object.entries(totals).sort((a, b) => b[1] - a[1]);

        addAssistantMessage(categories.length
            ? `Expense breakdown for ${getSelectedMonth()}: ${categories.map(([category, amount]) => `${category}: ${formatMoney(amount)}`).join("; ")}.`
            : `No expenses to break down for ${getSelectedMonth()} yet.`);
        return;
    }

    if (/\b(daily alert|daily limit|alert limit)\b/.test(normalizedMessage)) {
        addAssistantMessage(dailySpendingLimit > 0
            ? `Your daily spending alert is set to ${formatMoney(dailySpendingLimit)}. Say “set daily alert to 0” to turn it off.`
            : "You don't have a daily spending alert set. Try “set daily alert to 5000” to create one.");
        return;
    }

    if (/\b(today|daily)\b/.test(normalizedMessage) && /\b(spent|spending|expense|expenses|total|much)\b/.test(normalizedMessage)) {
        const todayExpenses = transactions
            .filter(transaction =>
                transaction.type === "expense" &&
                transaction.date === getLocalDate()
            )
            .reduce((total, transaction) => total + transaction.amount, 0);
        addAssistantMessage(`You've spent ${formatMoney(todayExpenses)} today.${dailySpendingLimit > 0 ? ` Your daily alert limit is ${formatMoney(dailySpendingLimit)}.` : " You haven't set a daily alert limit."}`);
        return;
    }

    if (/\b(budget|monthly limit)\b/.test(normalizedMessage)) {
        const budget = Number(budgets[getSelectedMonth()]) || 0;
        const expenses = getMonthlyTransactions()
            .filter(transaction => transaction.type === "expense")
            .reduce((total, transaction) => total + transaction.amount, 0);
        addAssistantMessage(budget > 0
            ? `Your budget for ${getSelectedMonth()} is ${formatMoney(budget)}. You've spent ${formatMoney(expenses)}, leaving ${formatMoney(budget - expenses)}.`
            : `You haven't set a budget for ${getSelectedMonth()} yet. You can say “set budget to 30000” to create one.`);
        return;
    }

    const transactionCommand = /\b(add|log|record|spent|spend|paid|bought|received|earned|income)\b/.test(normalizedMessage);
    const hasAmount = /(?:₹\s*)?\d[\d,]*(?:\.\d{1,2})?/.test(message);

    if (/\b(summary|overview|balance|how much|spending|spent|expenses|income)\b/.test(normalizedMessage) &&
        (!transactionCommand || !hasAmount)) {
        addAssistantMessage(getAssistantSummary());
        return;
    }

    if (transactionCommand) {
        const draft = getAssistantTransactionDraft(message);
        if (!draft) {
            addAssistantMessage("I couldn't find a valid amount. Try something like “spent 250 on lunch” or “received 50000 salary”.");
            return;
        }

        pendingAssistantAction = { ...draft };
        addAssistantMessage(
            `Add this ${draft.type}: ${formatMoney(draft.amount)} for ${draft.description} (${draft.category}), dated today?`,
            "bot",
            pendingAssistantAction
        );
        return;
    }

    addAssistantMessage("I can add an expense or income, set your monthly budget, and answer questions about your spending. Type “help” to see examples.");
}

function confirmAssistantAction(shouldConfirm, actionId) {
    const action = pendingAssistantAction;
    if (!action || action.id !== Number(actionId)) {
        return;
    }

    pendingAssistantAction = null;

    if (!action) {
        return;
    }

    if (!shouldConfirm) {
        addAssistantMessage("Okay, I won't save that.");
        return;
    }

    if (action.type === "daily-limit") {
        const previousDailyLimit = dailySpendingLimit;
        dailySpendingLimit = action.amount;

        if (!saveData()) {
            dailySpendingLimit = previousDailyLimit;
            addAssistantMessage("I couldn't save that daily alert. Please try again.");
            return;
        }

        dailyLimitStatus.textContent =
            action.amount === 0 ? "Daily alert turned off." : "Daily alert saved.";
        renderDashboard();
        addAssistantMessage(action.amount === 0
            ? "Your daily spending alert is turned off."
            : `Daily spending alert set to ${formatMoney(action.amount)}.`);
        return;
    }

    if (action.type === "budget") {
        const previousBudget = budgets[action.month];
        budgets[action.month] = action.amount;

        if (!saveData()) {
            if (previousBudget === undefined) {
                delete budgets[action.month];
            } else {
                budgets[action.month] = previousBudget;
            }
            addAssistantMessage("I couldn't save that budget. Please try again.");
            return;
        }

        renderDashboard();
        addAssistantMessage(`Budget for ${action.month} set to ${formatMoney(action.amount)}.`);
        return;
    }

    const previousTransactions = transactions;
    transactions = [...transactions, {
        id: Date.now() + Math.random(),
        description: action.description,
        amount: action.amount,
        type: action.type,
        category: action.category,
        date: action.date
    }];

    if (!saveData()) {
        transactions = previousTransactions;
        addAssistantMessage("I couldn't save that transaction. Please try again.");
        return;
    }

    monthFilter.value = action.date.slice(0, 7);
    typeFilter.value = "all";
    renderDashboard();
    addAssistantMessage(`Saved ${action.type}: ${formatMoney(action.amount)} for ${action.description}.`);

    if (action.type === "expense" && action.date === getLocalDate() && dailySpendingLimit > 0) {
        const todayExpenses = transactions
            .filter(transaction =>
                transaction.type === "expense" &&
                transaction.date === getLocalDate()
            )
            .reduce((total, transaction) => total + transaction.amount, 0);
        if (todayExpenses >= dailySpendingLimit) {
            showDailyAlert(todayExpenses, dailySpendingLimit);
        }
    }
}

assistantToggle.addEventListener("click", function () {
    financeAssistant.hidden = !financeAssistant.hidden;
    assistantToggle.setAttribute("aria-expanded", String(!financeAssistant.hidden));
    if (!financeAssistant.hidden) {
        assistantInput.focus();
    }
});

closeAssistantButton.addEventListener("click", function () {
    financeAssistant.hidden = true;
    assistantToggle.setAttribute("aria-expanded", "false");
    assistantToggle.focus();
});

assistantForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const message = assistantInput.value.trim();
    if (!message) {
        return;
    }
    if (pendingAssistantAction) {
        pendingAssistantAction = null;
        assistantMessages.querySelectorAll("[data-assistant-choice]").forEach(button => {
            button.disabled = true;
        });
        addAssistantMessage("I canceled the pending change because you sent a new request.");
    }
    addAssistantMessage(message, "user");
    assistantInput.value = "";
    handleAssistantMessage(message);
});

assistantMessages.addEventListener("click", function (event) {
    const button = event.target.closest("[data-assistant-choice]");
    if (button) {
        confirmAssistantAction(
            button.dataset.assistantChoice === "confirm",
            button.dataset.assistantId
        );
    }
});

document.querySelector(".assistant-suggestions").addEventListener("click", function (event) {
    const button = event.target.closest("[data-assistant-prompt]");
    if (!button) {
        return;
    }
    assistantInput.value = button.dataset.assistantPrompt;
    assistantForm.requestSubmit();
});

// ========================================
// INITIAL SETTINGS
// ========================================

monthFilter.value = getCurrentMonth();
dateInput.value = getLocalDate();

let dailyAlertTimeout;

function dismissDailyAlert() {
    dailyAlertPopup.hidden = true;
    window.clearTimeout(dailyAlertTimeout);
}

function showDailyAlert(spent, limit) {
    const status = spent > limit ? "exceeded" : "reached";
    dailyAlertMessage.textContent =
        `Daily spending alert: today's total is ${formatMoney(spent)} and has ${status} your ${formatMoney(limit)} limit.`;
    dailyAlertPopup.hidden = false;

    window.clearTimeout(dailyAlertTimeout);
    dailyAlertTimeout = window.setTimeout(dismissDailyAlert, 8000);
}

dismissDailyAlertButton.addEventListener("click", dismissDailyAlert);

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
// SET DAILY SPENDING ALERT
// ========================================

dailyLimitForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const amount = Number(dailyLimitAmount.value);

    if (
        dailyLimitAmount.value.trim() === "" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 1000000000
    ) {
        alert("Please enter a valid daily spending limit.");
        return;
    }

    const previousDailyLimit = dailySpendingLimit;
    dailySpendingLimit = amount;

    if (saveData()) {
        dailyLimitStatus.textContent =
            amount === 0 ? "Daily alert turned off." : "Daily alert saved.";
        renderDashboard();
    } else {
        dailySpendingLimit = previousDailyLimit;
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

        if (type === "expense" && date === getLocalDate() && dailySpendingLimit > 0) {
            const dailyExpenses = transactions
                .filter(transaction =>
                    transaction.type === "expense" &&
                    transaction.date === getLocalDate()
                )
                .reduce((total, transaction) => total + transaction.amount, 0);

            if (dailyExpenses >= dailySpendingLimit) {
                showDailyAlert(dailyExpenses, dailySpendingLimit);
            }
        }
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

    // Keep balance indicators within the monochrome theme.
    remainingBalanceElement.style.color =
        remainingBudget < 0 ? "#a0a6ad" : "#f1f3f4";

    netBalanceElement.style.color =
        netBalance < 0 ? "#a0a6ad" : "#f1f3f4";

    // Display selected month's budget
    budgetAmount.value = budgets[getSelectedMonth()] ?? "";
    dailyLimitAmount.value = dailySpendingLimit;

    // Update budget progress
    const percentage = budget > 0
        ? (expenses / budget) * 100
        : 0;

    budgetProgress.style.width =
        Math.min(percentage, 100) + "%";

    budgetProgress.style.background =
        percentage > 100 ? "#ffb4a9" : "#b9e4c5";

    const progressBar = budgetProgress.parentElement;
    progressBar.setAttribute(
        "aria-valuenow",
        String(Math.min(Math.max(percentage, 0), 100))
    );
    progressBar.setAttribute(
        "aria-valuetext",
        budget > 0 ? `${percentage.toFixed(1)}% of budget used` : "No budget set"
    );

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
        "Are you sure? This will permanently delete all saved budgets, transactions, and daily alert settings."
    )) {
        return;
    }

    const previousTransactions = transactions;
    const previousBudgets = budgets;
    const previousDailyLimit = dailySpendingLimit;

    transactions = [];
    budgets = {};
    dailySpendingLimit = 0;

    if (!saveData()) {
        transactions = previousTransactions;
        budgets = previousBudgets;
        dailySpendingLimit = previousDailyLimit;
        return;
    }

    dailyLimitStatus.textContent = "";
    dismissDailyAlert();
    renderDashboard();

    alert("All budgets, transactions, and daily alert settings have been cleared.");
});

// ========================================
// INITIALIZE APPLICATION
// ========================================

renderDashboard();