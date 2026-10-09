import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Download,
  Terminal,
  Table as TableIcon,
  Columns,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  AlertCircle,
  Clock,
  HardDrive,
  FileText,
  Sparkles,
  Eye,
  X,
  Play,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Code2
} from 'lucide-react';

interface ColumnMeta {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface TableSchema {
  name: string;
  rowCount: number;
  columns: ColumnMeta[];
}

interface DbSchemaResponse {
  success: boolean;
  databasePath: string;
  sqliteVersion: string;
  journalMode: string;
  tableCount: number;
  totalRows: number;
  tables: TableSchema[];
}

interface TableDataResponse {
  success: boolean;
  tableName: string;
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  durationMs: number;
  executedSql: string;
}

export const DatabaseBrowserView: React.FC = () => {
  // Schema & metadata state
  const [schemaData, setSchemaData] = useState<DbSchemaResponse | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState<boolean>(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Table selector state
  const [selectedTable, setSelectedTable] = useState<string>('triage_rules');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Table data state
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [isLoadingTable, setIsLoadingTable] = useState<boolean>(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [searchInTable, setSearchInTable] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageLimit, setPageLimit] = useState<number>(25);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // View modes: 'data' | 'schema' | 'query'
  const [activeTab, setActiveTab] = useState<'data' | 'schema' | 'query'>('data');

  // SQL Query console state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM triage_rules WHERE severity = "RED" LIMIT 50;');
  const [isExecutingQuery, setIsExecutingQuery] = useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Row inspection modal
  const [inspectRow, setInspectRow] = useState<Record<string, any> | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // 1. Fetch Schema & Table List
  const fetchSchema = async () => {
    setIsLoadingSchema(true);
    setSchemaError(null);
    try {
      const res = await fetch('/api/db-browser/schema');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load database schema`);
      const data: DbSchemaResponse = await res.json();
      setSchemaData(data);
      if (data.tables && data.tables.length > 0 && !data.tables.some(t => t.name === selectedTable)) {
        setSelectedTable(data.tables[0].name);
      }
    } catch (e: any) {
      console.error('Error loading schema:', e);
      setSchemaError(e.message || 'Failed to connect to SQLite schema endpoint');
    } finally {
      setIsLoadingSchema(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, []);

  // 2. Fetch Active Table Data
  const fetchTableData = async () => {
    if (!selectedTable) return;
    setIsLoadingTable(true);
    setTableError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageLimit),
      });
      if (searchInTable.trim()) params.append('search', searchInTable.trim());
      if (sortBy) {
        params.append('sortBy', sortBy);
        params.append('sortOrder', sortOrder);
      }

      const res = await fetch(`/api/db-browser/tables/${selectedTable}?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}: Failed to fetch rows for '${selectedTable}'`);
      }
      const data: TableDataResponse = await res.json();
      setTableData(data);
    } catch (e: any) {
      console.error(`Error loading table ${selectedTable}:`, e);
      setTableError(e.message || 'Error fetching table contents');
    } finally {
      setIsLoadingTable(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchTableData();
  }, [selectedTable, pageLimit, sortBy, sortOrder]);

  useEffect(() => {
    fetchTableData();
  }, [currentPage]);

  const handleTableSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTableData();
  };

  // 3. Execute SQL Query
  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecutingQuery(true);
    setQueryError(null);
    try {
      const res = await fetch('/api/db-browser/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlQuery.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Query execution failed');
      }
      setQueryResult(data);
    } catch (e: any) {
      setQueryError(e.message || 'SQL Execution error');
      setQueryResult(null);
    } finally {
      setIsExecutingQuery(false);
    }
  };

  // Filtered tables for the left sidebar
  const filteredTables = useMemo(() => {
    if (!schemaData?.tables) return [];
    if (!tableSearchQuery.trim()) return schemaData.tables;
    const q = tableSearchQuery.toLowerCase();
    return schemaData.tables.filter(t => t.name.toLowerCase().includes(q));
  }, [schemaData, tableSearchQuery]);

  // Current active table schema
  const currentTableSchema = useMemo(() => {
    return schemaData?.tables.find(t => t.name === selectedTable) || null;
  }, [schemaData, selectedTable]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(id);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  // Sort helper
  const handleHeaderClick = (colName: string) => {
    if (sortBy === colName) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortBy('');
        setSortOrder('asc');
      }
    } else {
      setSortBy(colName);
      setSortOrder('asc');
    }
  };

  // Render cell content nicely
  const renderCellContent = (value: any, colName: string) => {
    if (value === null || value === undefined) {
      return <span className="text-slate-400 italic font-mono text-[11px]">NULL</span>;
    }

    // Severity pill formatting
    if (colName.toLowerCase() === 'severity') {
      const str = String(value).toUpperCase();
      const color =
        str === 'RED' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' :
        str === 'ORANGE' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' :
        str === 'YELLOW' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30' :
        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${color}`}>
          {str}
        </span>
      );
    }

    // Boolean display
    if (typeof value === 'boolean' || value === 1 && (colName.startsWith('is_') || colName.startsWith('enable_'))) {
      const boolVal = Boolean(value);
      return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${boolVal ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${boolVal ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {boolVal ? 'TRUE' : 'FALSE'}
        </span>
      );
    }

    // JSON or Long content
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const isJson = (strVal.startsWith('{') && strVal.endsWith('}')) || (strVal.startsWith('[') && strVal.endsWith(']'));

    if (isJson || strVal.length > 50) {
      return (
        <div className="flex items-center gap-1.5 max-w-xs">
          <span className="truncate font-mono text-[11px] text-slate-700 dark:text-slate-300">
            {strVal.slice(0, 45)}...
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInspectRow({ [colName]: value });
            }}
            className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 text-[10px] font-bold transition-all shrink-0"
            title="Inspect full JSON / content"
          >
            <Eye size={12} />
          </button>
        </div>
      );
    }

    return (
      <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate block max-w-xs">
        {strVal}
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Cockpit Header Card */}
      <div className="bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md border border-teal-300/30 shrink-0">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  SQLite Database Browser
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {schemaData?.journalMode || 'WAL'} Storage
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  v{schemaData?.sqliteVersion || '3.53'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Direct persistent store:</span>
                <code className="text-teal-600 dark:text-teal-400 font-bold font-mono">
                  {schemaData?.databasePath || 'data/chat.db'}
                </code>
                <span>•</span>
                <span>{schemaData?.tableCount || 0} Tables</span>
                <span>•</span>
                <span>{schemaData?.totalRows?.toLocaleString() || 0} Total Records</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={fetchSchema}
              disabled={isLoadingSchema}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoadingSchema ? 'animate-spin' : ''} />
              <span>Refresh Schema</span>
            </button>

            <a
              href={`/api/db-browser/export/${selectedTable}?format=csv`}
              download={`${selectedTable}.csv`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-700/60 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </a>

            <a
              href={`/api/db-browser/export/${selectedTable}?format=json`}
              download={`${selectedTable}.json`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-700/60 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Code2 size={13} />
              <span>Export JSON</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Table Sidebar + Table Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Table List Navigator (3 Cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Tables Registry
              </span>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
              {filteredTables.length} / {schemaData?.tableCount || 0}
            </span>
          </div>

          {/* Table Search Filter */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter tables..."
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>

          {/* Scrollable Table List */}
          <div className="max-h-[600px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {isLoadingSchema ? (
              <div className="py-10 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw size={18} className="animate-spin mx-auto text-teal-500" />
                <p>Loading SQLite catalog...</p>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No matching tables found.
              </div>
            ) : (
              filteredTables.map((t) => {
                const isActive = t.name === selectedTable;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => {
                      setSelectedTable(t.name);
                      setSearchInTable('');
                      setSortBy('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left ${
                      isActive
                        ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TableIcon size={13} className={isActive ? 'text-slate-950 shrink-0' : 'text-slate-400 shrink-0'} />
                      <span className="truncate">{t.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ml-1 ${
                      isActive
                        ? 'bg-slate-950 text-teal-300 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {t.rowCount}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Table Viewport & Tabs (9 Cols) */}
        <div className="lg:col-span-9 space-y-4">
          {/* View Mode Tabs (Data Grid / Schema / SQL Console) */}
          <div className="bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('data')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'data'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <TableIcon size={14} />
                <span>Data Grid</span>
                {tableData && (
                  <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded-full font-mono">
                    {tableData.totalRows}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schema')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'schema'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Columns size={14} />
                <span>Schema Details</span>
                {currentTableSchema && (
                  <span className="text-[10px] bg-slate-950/20 px-1.5 py-0.2 rounded-full font-mono">
                    {currentTableSchema.columns.length} cols
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('query')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'query'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Terminal size={14} />
                <span>Read-Only SQL Console</span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded-full font-black uppercase">
                  Safe
                </span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 pr-2 text-xs text-slate-500">
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {selectedTable}
              </span>
            </div>
          </div>

          {/* TAB 1: DATA GRID VIEW */}
          {activeTab === 'data' && (
            <div className="bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              {/* Table Controls Bar: Search & Page Limit */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <form onSubmit={handleTableSearchSubmit} className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Search within '${selectedTable}'...`}
                    value={searchInTable}
                    onChange={(e) => setSearchInTable(e.target.value)}
                    className="w-full pl-9 pr-16 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-[10px] font-black uppercase transition-all"
                  >
                    Find
                  </button>
                </form>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Rows per page:</span>
                  <select
                    value={pageLimit}
                    onChange={(e) => setPageLimit(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>

                  <button
                    type="button"
                    onClick={fetchTableData}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-all"
                    title="Reload data"
                  >
                    <RefreshCw size={13} className={isLoadingTable ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table Body & Scroll Viewport */}
              {isLoadingTable ? (
                <div className="py-20 text-center text-xs text-slate-400 space-y-3">
                  <RefreshCw size={24} className="animate-spin mx-auto text-teal-500" />
                  <p>Querying SQLite table '{selectedTable}'...</p>
                </div>
              ) : tableError ? (
                <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-3">
                  <AlertCircle size={18} className="shrink-0 text-red-500" />
                  <span>{tableError}</span>
                </div>
              ) : !tableData || tableData.rows.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <TableIcon size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="font-bold text-slate-600 dark:text-slate-400">No records found</p>
                  <p className="text-[11px]">
                    Table '{selectedTable}' has 0 matching rows.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        {tableData.columns.map((col) => {
                          const isSorted = sortBy === col.name;
                          return (
                            <th
                              key={col.name}
                              onClick={() => handleHeaderClick(col.name)}
                              className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{col.name}</span>
                                {col.pk === 1 && (
                                  <span className="text-[8px] bg-amber-500/20 text-amber-700 dark:text-amber-400 px-1 rounded font-mono">
                                    PK
                                  </span>
                                )}
                                <span className="text-[9px] text-slate-400 font-mono font-normal">
                                  {col.type}
                                </span>
                                {isSorted ? (
                                  sortOrder === 'asc' ? <ArrowUp size={12} className="text-teal-500" /> : <ArrowDown size={12} className="text-teal-500" />
                                ) : (
                                  <ArrowUpDown size={11} className="text-slate-300 dark:text-slate-600" />
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {tableData.rows.map((row, rIdx) => {
                        const rowNum = (currentPage - 1) * pageLimit + rIdx + 1;
                        return (
                          <tr
                            key={rIdx}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors group"
                          >
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">
                              {rowNum}
                            </td>
                            {tableData.columns.map((col) => (
                              <td key={col.name} className="py-2.5 px-3">
                                {renderCellContent(row[col.name], col.name)}
                              </td>
                            ))}
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setInspectRow(row)}
                                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 text-[10px] font-bold transition-all"
                              >
                                View Row
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {tableData && tableData.totalRows > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                  <div>
                    Showing <span className="font-bold text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageLimit + 1}</span> to{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {Math.min(currentPage * pageLimit, tableData.totalRows)}
                    </span>{' '}
                    of <span className="font-bold text-slate-800 dark:text-slate-200">{tableData.totalRows}</span> rows
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1 || isLoadingTable}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 transition-all"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-3 py-1 font-mono font-bold text-slate-700 dark:text-slate-300">
                      Page {currentPage} of {tableData.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p => Math.min(tableData.totalPages, p + 1))}
                      disabled={currentPage >= tableData.totalPages || isLoadingTable}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40 hover:bg-slate-50 transition-all"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEMA DETAILS VIEW */}
          {activeTab === 'schema' && (
            <div className="bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Columns size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>Schema Definition: {selectedTable}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Column metadata extracted via SQLite PRAGMA table_info
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                  {currentTableSchema?.columns.length || 0} Columns
                </span>
              </div>

              {currentTableSchema ? (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                        <th className="py-2.5 px-3">CID</th>
                        <th className="py-2.5 px-3">Column Name</th>
                        <th className="py-2.5 px-3">Data Type</th>
                        <th className="py-2.5 px-3">Not Null</th>
                        <th className="py-2.5 px-3">Default Value</th>
                        <th className="py-2.5 px-3">Primary Key</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      {currentTableSchema.columns.map((col) => (
                        <tr key={col.cid} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                          <td className="py-2 px-3 text-slate-400">{col.cid}</td>
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{col.name}</td>
                          <td className="py-2 px-3 text-teal-600 dark:text-teal-400 font-bold">{col.type || 'ANY'}</td>
                          <td className="py-2 px-3">
                            {col.notnull === 1 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">YES</span>
                            ) : (
                              <span className="text-slate-400">NO</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{col.dflt_value === null ? 'NULL' : String(col.dflt_value)}</td>
                          <td className="py-2 px-3">
                            {col.pk === 1 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-700 dark:text-amber-400">
                                PRIMARY KEY
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  Select a table from the sidebar to inspect schema.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: READ-ONLY SQL CONSOLE VIEW */}
          {activeTab === 'query' && (
            <div className="bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <span>Safe Read-Only SQL Query Console</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Execute ad-hoc SELECT queries against <code className="text-teal-500 font-mono">data/chat.db</code>. Mutating commands (DROP/DELETE/UPDATE) are hard-blocked.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExecuteQuery}
                    disabled={isExecutingQuery || !sqlQuery.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Play size={13} className={isExecutingQuery ? 'animate-spin' : ''} />
                    <span>Run Query</span>
                  </button>
                </div>
              </div>

              {/* Quick Template Queries */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Preset Queries
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Red Flag Rules', sql: 'SELECT rule_id, ailment, severity, rationale FROM triage_rules WHERE severity = "RED";' },
                    { label: 'All Triage Decisions', sql: 'SELECT ailment_code, severity, status_action FROM triage_decisions;' },
                    { label: 'All Households', sql: 'SELECT id, name, postal_code, created_at FROM households;' },
                    { label: 'Clinical Guardrails', sql: 'SELECT * FROM clinical_guardrails;' },
                    { label: 'Recent Audit Events', sql: 'SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 25;' }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setSqlQuery(preset.sql)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/60 text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-800 transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Query Editor Textarea */}
              <div className="relative">
                <textarea
                  rows={4}
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM triage_rules WHERE severity = 'RED' LIMIT 50;"
                  className="w-full p-3 font-mono text-xs rounded-xl bg-slate-900 text-teal-300 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>

              {/* Error Alert */}
              {queryError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{queryError}</span>
                </div>
              )}

              {/* Query Results */}
              {queryResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {queryResult.rowCount} rows returned
                      </span>
                      <span>•</span>
                      <span className="font-mono text-teal-600 dark:text-teal-400">
                        {queryResult.durationMs}ms execution time
                      </span>
                    </div>
                  </div>

                  {queryResult.rows.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Query returned 0 rows.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-96 custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 sticky top-0">
                            {queryResult.columns.map((col) => (
                              <th key={col} className="py-2 px-3">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                          {queryResult.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                              {queryResult.columns.map((col) => (
                                <td key={col} className="py-2 px-3">
                                  {renderCellContent(row[col], col)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Row & JSON Inspector */}
      {inspectRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F1A20] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Record Details Inspector
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectRow(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1 custom-scrollbar">
              {Object.entries(inspectRow).map(([key, val]) => {
                const str = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
                const isObj = typeof val === 'object' || (str.startsWith('{') || str.startsWith('['));

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 font-mono">
                        {key}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(str, key)}
                        className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-teal-500 font-bold"
                      >
                        {copiedCell === key ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        <span>{copiedCell === key ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {isObj ? (
                      <pre className="p-3 rounded-xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto">
                        {typeof val === 'string' ? (() => {
                          try { return JSON.stringify(JSON.parse(val), null, 2); }
                          catch(e) { return val; }
                        })() : str}
                      </pre>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-words">
                        {str}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectRow(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
