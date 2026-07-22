import React, { useState, useEffect } from 'react';
import { Expense, Trip, LocationItem } from '../types';
import { getAllFromStore, saveToStore, deleteFromStore } from '../db';
import { DollarSign, Plus, Trash2, Tag, Calendar, FileText, Image as ImageIcon, Search, ArrowUpRight, Percent } from 'lucide-react';

interface ExpenseTrackerProps {
  trips: Trip[];
  locations: LocationItem[];
}

export default function ExpenseTracker({ trips, locations }: ExpenseTrackerProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Gemini AI receipt scanning state
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTripFilter, setSelectedTripFilter] = useState<string>('all');

  // New Expense form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState<Expense['category']>('food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tripId, setTripId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);

  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);

  const scanReceiptWithAI = async (base64String: string) => {
    setIsScanningReceipt(true);
    setScanError(null);
    try {
      const response = await fetch("/api/gemini/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64String }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse receipt with Gemini AI");
      }

      const data = await response.json();
      
      // Smart Auto-Fill of the expense form based on structural OCR output
      if (data.merchant) setTitle(data.merchant);
      if (data.amount) setAmount(data.amount.toString());
      if (data.currency) setCurrency(data.currency);
      if (data.category) setCategory(data.category);
      if (data.date) setDate(data.date);
      if (data.notes) setNotes(data.notes);
    } catch (err: any) {
      console.error("AI Receipt Scan error:", err);
      setScanError(err.message || "Failed to parse receipt details.");
    } finally {
      setIsScanningReceipt(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [trips]);

  useEffect(() => {
    applyFilters();
  }, [expenses, searchQuery, selectedCategory, selectedTripFilter]);

  const loadExpenses = async () => {
    const allExp = await getAllFromStore<Expense>('expenses');
    // Sort descending by date
    allExp.sort((a, b) => b.date.localeCompare(a.date));
    setExpenses(allExp);
  };

  const applyFilters = () => {
    let result = [...expenses];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((e) => e.category === selectedCategory);
    }

    if (selectedTripFilter !== 'all') {
      result = result.filter((e) => e.tripId === selectedTripFilter);
    }

    setFilteredExpenses(result);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setReceiptBase64(base64);
      scanReceiptWithAI(base64);
    };
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !tripId) return;

    const newExpense: Expense = {
      id: `expense-${Date.now()}`,
      tripId,
      locationId: locationId || undefined,
      title,
      amount: parseFloat(amount),
      currency,
      category,
      date,
      notes,
      receiptBase64: receiptBase64 || undefined,
      createdAt: new Date().toISOString(),
    };

    await saveToStore('expenses', newExpense);
    loadExpenses();
    setIsAddingExpense(false);

    // Reset Form
    setTitle('');
    setAmount('');
    setCurrency('USD');
    setCategory('food');
    setDate(new Date().toISOString().split('T')[0]);
    setTripId('');
    setLocationId('');
    setNotes('');
    setReceiptBase64(null);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      await deleteFromStore('expenses', expenseId);
      loadExpenses();
    }
  };

  // Group currencies to display summary
  const getTotalsByCurrency = () => {
    const totals: { [currency: string]: number } = {};
    expenses.forEach((e) => {
      totals[e.currency] = (totals[e.currency] || 0) + e.amount;
    });
    return totals;
  };

  // Get percentage totals by category for active filters/view
  const getCategoryBreakdown = () => {
    const breakdown: { [key in Expense['category']]: number } = {
      food: 0,
      transport: 0,
      accommodation: 0,
      activities: 0,
      shopping: 0,
      other: 0,
    };

    let totalVal = 0;
    filteredExpenses.forEach((e) => {
      // For simplicity in visualization, sum up values irrespective of currency
      // or assume equivalent weights in layout bars.
      breakdown[e.category] += e.amount;
      totalVal += e.amount;
    });

    return { breakdown, total: totalVal };
  };

  const totals = getTotalsByCurrency();
  const { breakdown: catTotals, total: totalSum } = getCategoryBreakdown();

  const categories: { label: string; value: Expense['category']; color: string }[] = [
    { label: 'Food & Dining', value: 'food', color: 'bg-amber-500' },
    { label: 'Transport', value: 'transport', color: 'bg-blue-500' },
    { label: 'Hotel & Stay', value: 'accommodation', color: 'bg-indigo-500' },
    { label: 'Activities', value: 'activities', color: 'bg-emerald-500' },
    { label: 'Shopping', value: 'shopping', color: 'bg-purple-500' },
    { label: 'Other', value: 'other', color: 'bg-rose-500' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Spendings Summary Header Card */}
      <div className="lg:col-span-4 bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-5">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Expenditure Dashboard</h3>
          <p className="text-xs text-gray-500 mt-0.5 font-sans">Track receipts & travel spending.</p>
        </div>

        {/* Totals Box */}
        <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100 flex flex-col gap-3">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
            Total Spendings
          </span>
          {Object.keys(totals).length === 0 ? (
            <span className="text-xl font-bold text-gray-400 font-sans">$0.00</span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {Object.entries(totals).map(([curr, val]) => (
                <div key={curr} className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-gray-500 uppercase font-mono">{curr}</span>
                  <span className="text-xl font-bold text-emerald-800 font-mono">
                    {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visual Category Breakdown Progress Bars */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold text-gray-600">Category Allocations</span>
          <div className="flex flex-col gap-3">
            {categories.map((cat) => {
              const amount = catTotals[cat.value];
              const pct = totalSum > 0 ? (amount / totalSum) * 100 : 0;
              return (
                <div key={cat.value} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-medium text-gray-600">
                    <span>{cat.label}</span>
                    <span className="font-mono">
                      {pct > 0 ? `${pct.toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trigger */}
        <button
          onClick={() => setIsAddingExpense(true)}
          disabled={trips.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Log Travel Expense
        </button>
        {trips.length === 0 && (
          <p className="text-[10px] text-center text-amber-600 font-semibold leading-relaxed">
            * Please create an itinerary trip first to log expenditures.
          </p>
        )}
      </div>

      {/* Expenses History Logs & Filter List */}
      <div className="lg:col-span-8 bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm self-start">Expenditure Records</h3>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial min-w-[120px]">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-gray-100 focus:outline-emerald-600"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-100 rounded-xl"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              value={selectedTripFilter}
              onChange={(e) => setSelectedTripFilter(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-100 rounded-xl max-w-[120px]"
            >
              <option value="all">All Trips</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expenses Table/List */}
        <div className="flex-1 overflow-y-auto max-h-[400px] flex flex-col gap-2.5 pr-1">
          {filteredExpenses.length === 0 ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
              <FileText className="w-8 h-8 text-gray-200" />
              <p className="text-xs font-semibold">No travel expenditures match your query.</p>
            </div>
          ) : (
            filteredExpenses.map((exp) => {
              const tripObj = trips.find((t) => t.id === exp.tripId);
              const locObj = locations.find((l) => l.id === exp.locationId);
              const categoryColor = categories.find((c) => c.value === exp.category)?.color || 'bg-gray-400';

              return (
                <div
                  key={exp.id}
                  className="p-3 rounded-xl border border-gray-100/80 flex justify-between items-center gap-4 hover:bg-gray-50/40 transition-colors group"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    {/* Visual color dot for category */}
                    <div className={`w-2.5 h-2.5 rounded-full ${categoryColor} shrink-0`}></div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-800 text-xs truncate flex items-center gap-1.5">
                        {exp.title}
                        {exp.receiptBase64 && (
                          <button
                            onClick={() => setActiveReceiptUrl(exp.receiptBase64 || null)}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shrink-0"
                            title="View Receipt"
                          >
                            <ImageIcon className="w-3 h-3" /> Receipt
                          </button>
                        )}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 flex-wrap">
                        <span className="font-mono">{new Date(exp.date).toLocaleDateString()}</span>
                        {tripObj && <span className="truncate max-w-[80px]">🚢 {tripObj.name}</span>}
                        {locObj && <span className="truncate max-w-[80px]">📍 {locObj.name}</span>}
                      </div>
                      {exp.notes && (
                        <p className="text-[10px] text-gray-500 italic mt-1 font-sans line-clamp-1">{exp.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-gray-900 font-mono">
                      {exp.currency} {exp.amount.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="Delete log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Expense Modal */}
        {isAddingExpense && trips.length > 0 && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 text-sm mb-4">Log Travel Expenditure</h4>
              <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Item Name / Expense Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    placeholder="E.g., Dinner at Bistro, Taxi ride"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col col-span-2 gap-1">
                    <label className="text-xs font-semibold text-gray-600">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium font-mono"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="CAD">CAD ($)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Trip / Itinerary</label>
                    <select
                      required
                      value={tripId}
                      onChange={(e) => setTripId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    >
                      <option value="">-- Choose Trip --</option>
                      {trips.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Location Tag</label>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    >
                      <option value="">-- Choose Location --</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    >
                      <option value="food">Food & Dining</option>
                      <option value="transport">Transport</option>
                      <option value="accommodation">Accommodation</option>
                      <option value="activities">Activities</option>
                      <option value="shopping">Shopping</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium font-mono"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Upload Receipt Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="w-full text-xs px-3 py-1.5 border border-gray-200 rounded-xl"
                  />
                </div>
                {isScanningReceipt && (
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between gap-2 animate-pulse">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] text-emerald-800 font-bold">✨ Gemini is auto-filling form details...</span>
                    </div>
                    <span className="text-[8px] text-emerald-600 uppercase tracking-widest font-mono">Analyzing</span>
                  </div>
                )}
                {scanError && (
                  <div className="p-2 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-600">
                    ⚠️ {scanError}
                  </div>
                )}
                {receiptBase64 && !isScanningReceipt && (
                  <div className="flex justify-between items-center bg-gray-50/60 p-2 border border-gray-100 rounded-xl">
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <span className="text-[12px]">✓</span> Receipt registered successfully
                    </span>
                    <button
                      type="button"
                      onClick={() => scanReceiptWithAI(receiptBase64)}
                      className="text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200 shadow-sm transition-all"
                    >
                      ✨ Re-scan receipt
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Expenditure Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-16 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium resize-none"
                    placeholder="Details about items, Split notes, bills, etc."
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingExpense(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl"
                  >
                    Log Expense
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Zoom receipt image modal */}
        {activeReceiptUrl && (
          <div
            onClick={() => setActiveReceiptUrl(null)}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
          >
            <div className="bg-white rounded-2xl overflow-hidden p-2 shadow-2xl border border-gray-200 max-w-lg max-h-[85vh] flex flex-col">
              <div className="overflow-auto flex-1">
                <img src={activeReceiptUrl} className="w-full h-auto object-contain" />
              </div>
              <p className="text-[10px] text-gray-400 text-center py-2 font-semibold">
                Click anywhere to close receipt viewer.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
