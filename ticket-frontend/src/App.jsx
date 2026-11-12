import { useEffect, useState } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp,
  Clock3, Inbox, LayoutDashboard, LogOut, MessageSquare, Plus, Search, Send,
  SlidersHorizontal, Sparkles, TicketCheck, UserRound, X,
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8081/api' : '')
const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const CATEGORIES = ['Account access', 'Billing', 'Technical issue', 'Product question', 'Other']

async function request(path, token, options = {}) {
  if (!API) {
    throw new Error('The API URL is not configured. Set VITE_API_URL in Vercel to your public HTTPS backend URL ending in /api.')
  }
  const apiUrl = new URL(API)
  if (!import.meta.env.DEV && ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname)) {
    throw new Error('Vercel cannot reach localhost. Set VITE_API_URL to your public HTTPS backend URL ending in /api.')
  }
  if (!import.meta.env.DEV && apiUrl.protocol !== 'https:') {
    throw new Error('The deployed API URL must use HTTPS.')
  }
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || body.error || `Request failed (${response.status})`)
  }
  if (response.status === 204) return null
  return response.json()
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function App() {
  const saved = JSON.parse(localStorage.getItem('relay-session') || 'null')
  const [session, setSession] = useState(saved)
  const [activeView, setActiveView] = useState(() => window.location.hash === '#tickets' ? 'tickets' : 'overview')
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 })
  const [agents, setAgents] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [selected, setSelected] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [comment, setComment] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [ticketForm, setTicketForm] = useState({ title: '', description: '', category: CATEGORIES[0], priority: 'MEDIUM', status: 'OPEN' })

  const token = session?.token
  const user = session?.user
  const isAgent = user?.role === 'AGENT'

  async function loadTickets(nextPage = page) {
    const params = new URLSearchParams({ page: String(nextPage), size: '8' })
    if (search.trim()) params.set('q', search.trim())
    if (statusFilter) params.set('status', statusFilter)
    if (priorityFilter) params.set('priority', priorityFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    const result = await request(`/tickets?${params}`, token)
    setTickets(result.content)
    setPageCount(result.totalPages)
    setPage(result.page)
  }

  async function refresh() {
    if (!token) return
    try {
      const [dashboard, agentList] = await Promise.all([
        request('/dashboard', token),
        isAgent ? request('/agents', token) : Promise.resolve([]),
      ])
      setStats(dashboard)
      setAgents(agentList)
      await loadTickets()
    } catch (issue) {
      setError(issue.message)
    }
  }

  useEffect(() => {
    if (token) refresh()
  }, [token, search, statusFilter, priorityFilter, categoryFilter])

  useEffect(() => {
    const syncActiveView = () => setActiveView(window.location.hash === '#tickets' ? 'tickets' : 'overview')
    window.addEventListener('hashchange', syncActiveView)
    return () => window.removeEventListener('hashchange', syncActiveView)
  }, [])

  async function submitAuth(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register'
      const result = await request(path, null, { method: 'POST', body: JSON.stringify(authForm) })
      localStorage.setItem('relay-session', JSON.stringify(result))
      setSession(result)
    } catch (issue) {
      setError(issue.message)
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    localStorage.removeItem('relay-session')
    setSession(null)
    setTickets([])
    setSelected(null)
  }

  async function openTicket(ticket) {
    setSelected(ticket)
    setTicketForm({ title: ticket.title, description: ticket.description, category: ticket.category, priority: ticket.priority, status: ticket.status })
    try {
      const [comments, activity] = await Promise.all([
        request(`/tickets/${ticket.id}/comments`, token),
        request(`/tickets/${ticket.id}/activity`, token),
      ])
      setTimeline([
        ...activity.map((item) => ({ ...item, kind: 'activity' })),
        ...comments.map((item) => ({ ...item, kind: 'comment', detail: item.body, actor: item.author })),
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
    } catch (issue) { setError(issue.message) }
  }

  async function saveTicket(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const path = editing ? `/tickets/${selected.id}` : '/tickets'
      const result = await request(path, token, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(ticketForm) })
      setShowForm(false)
      setEditing(false)
      if (editing) {
        setSelected(result)
      }
      await refresh()
      if (editing) await openTicket(result)
    } catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }

  async function updateTicket(patch) {
    setBusy(true)
    try {
      const updated = await request(`/tickets/${selected.id}`, token, {
        method: 'PUT', body: JSON.stringify({ ...ticketForm, ...patch }),
      })
      setSelected(updated)
      setTicketForm({ title: updated.title, description: updated.description, category: updated.category, priority: updated.priority, status: updated.status })
      await refresh()
      await openTicket(updated)
    } catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }

  async function assignTicket(agentId) {
    setBusy(true)
    try {
      const updated = await request(`/tickets/${selected.id}/assignment`, token, {
        method: 'PUT', body: JSON.stringify({ agentId: agentId ? Number(agentId) : null }),
      })
      setSelected(updated)
      await refresh()
      await openTicket(updated)
    } catch (issue) { setError(issue.message) }
    finally { setBusy(false) }
  }

  async function postComment(event) {
    event.preventDefault()
    if (!comment.trim()) return
    try {
      await request(`/tickets/${selected.id}/comments`, token, { method: 'POST', body: JSON.stringify({ body: comment }) })
      setComment('')
      await openTicket(selected)
    } catch (issue) { setError(issue.message) }
  }

  async function removeTicket() {
    if (!window.confirm('Delete this ticket and its history?')) return
    try {
      await request(`/tickets/${selected.id}`, token, { method: 'DELETE' })
      setSelected(null)
      await refresh()
    } catch (issue) { setError(issue.message) }
  }

  function startCreate() {
    setEditing(false)
    setTicketForm({ title: '', description: '', category: CATEGORIES[0], priority: 'MEDIUM', status: 'OPEN' })
    setShowForm(true)
  }

  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} onSubmit={submitAuth} busy={busy} error={error} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Relay home"><span className="brand-mark"><Activity size={19} /></span><span>relay<span className="brand-dot">.</span></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          <a className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} href="#overview" aria-current={activeView === 'overview' ? 'page' : undefined} onClick={() => setSelected(null)}><LayoutDashboard size={17} /> Overview</a>
          <a className={`nav-item ${activeView === 'tickets' ? 'active' : ''}`} href="#tickets" aria-current={activeView === 'tickets' ? 'page' : undefined} onClick={() => setSelected(null)}><Inbox size={17} /> {isAgent ? 'All tickets' : 'My tickets'} <span className="nav-count">{stats.total}</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box"><span className="help-icon"><CircleHelp size={17} /></span><div><strong>Need a hand?</strong><small>Our team is here to help.</small></div><ArrowRight size={15} /></div>
          <div className="profile-row"><span className="avatar avatar-olive">{initials(user.name)}</span><span className="profile-copy"><strong>{user.name}</strong><small>{isAgent ? 'Support agent' : 'Customer'}</small></span><button className="icon-button signout-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeView === 'tickets' ? (isAgent ? 'All tickets' : 'My tickets') : 'Overview'}</strong></div>
          <div className="top-actions"><span className="today-label"><span className="live-dot" /> All systems operational</span><span className="avatar avatar-coral">{initials(user.name)}</span></div>
        </header>

        <section className="page-content">
          <div className="welcome-row" id="overview"><div><div className="eyebrow">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</div><h1>{isAgent ? 'Good morning' : 'Your support desk'}<span className="heading-period">.</span></h1><p>{isAgent ? 'Here’s what’s happening across your queue.' : 'A clear view of every conversation with our team.'}</p></div><button className="primary-button" onClick={startCreate}><Plus size={17} /> New ticket</button></div>

          <div className="stats-grid">
            <Stat label={isAgent ? 'All tickets' : 'Your tickets'} value={stats.total} icon={<TicketCheck size={18} />} tone="mint" detail="Across all time" />
            <Stat label="Open" value={stats.open} icon={<Inbox size={18} />} tone="peach" detail="Needs attention" />
            <Stat label="In progress" value={stats.inProgress} icon={<Clock3 size={18} />} tone="blue" detail="Being worked on" />
            <Stat label="Resolved" value={stats.resolved} icon={<Check size={18} />} tone="yellow" detail="Ready to review" />
          </div>

          <section className="ticket-section" id="tickets">
            <div className="section-heading"><div><div className="eyebrow">SUPPORT QUEUE</div><h2>{isAgent ? 'Ticket overview' : 'Recent tickets'}</h2></div><button className="text-button" onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setCategoryFilter('') }}><SlidersHorizontal size={15} /> Reset filters</button></div>
            <div className="filter-bar"><label className="search-box"><Search size={17} /><input placeholder="Search tickets..." value={search} onChange={(event) => { setPage(0); setSearch(event.target.value) }} /></label><div className="filter-select"><select value={statusFilter} onChange={(event) => { setPage(0); setStatusFilter(event.target.value) }}><option value="">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select><ChevronDown size={14} /></div><div className="filter-select"><select value={priorityFilter} onChange={(event) => { setPage(0); setPriorityFilter(event.target.value) }}><option value="">All priorities</option>{PRIORITIES.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></div><div className="filter-select"><select value={categoryFilter} onChange={(event) => { setPage(0); setCategoryFilter(event.target.value) }}><option value="">All categories</option>{CATEGORIES.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14} /></div></div>

            <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Category</th><th>Priority</th><th>Status</th>{isAgent && <th>Assignee</th>}<th>Updated</th><th /></tr></thead><tbody>
              {tickets.map((ticket) => <tr key={ticket.id} onClick={() => openTicket(ticket)}><td><div className="ticket-title"><span className="ticket-id">#{String(ticket.id).padStart(4, '0')}</span><strong>{ticket.title}</strong><small>{isAgent ? `by ${ticket.createdBy.name}` : `Created ${dateLabel(ticket.createdAt)}`}</small></div></td><td><span className="category-label">{ticket.category}</span></td><td><Priority value={ticket.priority} /></td><td><Status value={ticket.status} /></td>{isAgent && <td><span className="assignee-cell">{ticket.assignedAgent ? <><span className="avatar avatar-mini">{initials(ticket.assignedAgent.name)}</span>{ticket.assignedAgent.name.split(' ')[0]}</> : <span className="unassigned">Unassigned</span>}</span></td>}<td className="date-cell">{dateLabel(ticket.updatedAt)}</td><td><button className="row-arrow" title="Open ticket"><ArrowRight size={16} /></button></td></tr>)}
              {!tickets.length && <tr><td colSpan={isAgent ? 7 : 6}><div className="empty-state"><span><Inbox size={21} /></span><strong>No tickets found</strong><small>Try adjusting your filters or create a ticket.</small><button onClick={startCreate}>Create a ticket <ArrowRight size={14} /></button></div></td></tr>}
            </tbody></table></div>
            <div className="pagination"><span>Page {pageCount ? page + 1 : 0} of {pageCount}</span><div><button disabled={page <= 0} onClick={() => loadTickets(page - 1)} title="Previous page"><ArrowLeft size={16} /></button><button disabled={page + 1 >= pageCount} onClick={() => loadTickets(page + 1)} title="Next page"><ArrowRight size={16} /></button></div></div>
          </section>
          {error && <div className="toast-error" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}
        </section>
      </main>

      {showForm && <TicketForm title={editing ? 'Edit ticket' : 'Create a ticket'} value={ticketForm} setValue={setTicketForm} onSubmit={saveTicket} onClose={() => setShowForm(false)} busy={busy} editing={editing} isAgent={isAgent} />}
      {selected && <TicketDetailPanel ticket={selected} user={user} isAgent={isAgent} agents={agents} timeline={timeline} comment={comment} setComment={setComment} busy={busy} onClose={() => setSelected(null)} onEdit={() => { setEditing(true); setTicketForm({ title: selected.title, description: selected.description, category: selected.category, priority: selected.priority, status: selected.status }); setShowForm(true) }} onStatus={(status) => updateTicket({ ...ticketForm, status })} onPriority={(priority) => updateTicket({ ...ticketForm, priority })} onAssign={assignTicket} onComment={postComment} onDelete={removeTicket} />}
    </div>
  )
}

function AuthScreen({ mode, setMode, form, setForm, onSubmit, busy, error }) {
  const register = mode === 'register'
  return <main className="auth-page"><section className="auth-art"><a className="brand brand-light" href="#home"><span className="brand-mark"><Activity size={19} /></span><span>relay<span className="brand-dot">.</span></span></a><div className="art-copy"><span className="art-kicker"><Sparkles size={14} /> SUPPORT, IN SYNC</span><h1>Good support<br />moves everyone<br /><em>forward.</em></h1><p>Your conversations, in one thoughtful place.</p><div className="art-note"><div className="note-avatars"><span>MK</span><span>AL</span><span>JD</span></div><div><strong>People-first support</strong><small>Better answers. Happier teams.</small></div><ArrowRight size={16} /></div></div><div className="art-index">01 <span /> 03</div></section><section className="auth-panel"><div className="auth-form-wrap"><div className="eyebrow">{register ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</div><h2>{register ? 'Get the help you need.' : 'Let’s get you sorted.'}</h2><p className="auth-subtitle">{register ? 'Set up your space and keep every request on track.' : 'Sign in to pick up where you left off.'}</p><form className="auth-form" onSubmit={onSubmit}>{register && <label>Your name<input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Jamie Chen" /></label>}<label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@company.com" /></label><label>Password<input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={register ? 'At least 8 characters' : 'Enter your password'} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button></form><div className="auth-switch">{register ? 'Already have an account?' : 'New to Relay?'} <button onClick={() => setMode(register ? 'login' : 'register')}>{register ? 'Sign in' : 'Create an account'}</button></div><div className="auth-foot"><span>SECURE ACCESS</span><span><span className="live-dot" /> End-to-end protected</span></div></div></section></main>
}

function Stat({ label, value, icon, tone, detail }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-detail">{detail}</span><div className="stat-number">{value}</div><div className="stat-label">{label}</div><div className="stat-rule" /></article>
}

function Status({ value }) {
  const labels = { OPEN: 'Open', IN_PROGRESS: 'In progress', WAITING: 'Waiting', RESOLVED: 'Resolved', CLOSED: 'Closed' }
  return <span className={`status-pill status-${value.toLowerCase().replace('_', '-')}`}><i />{labels[value] || value}</span>
}

function Priority({ value }) {
  return <span className={`priority-label priority-${value.toLowerCase()}`}><i />{value.toLowerCase()}</span>
}

function TicketForm({ title, value, setValue, onSubmit, onClose, busy, editing, isAgent }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="form-modal"><div className="modal-head"><div><div className="eyebrow">TICKET WORKSPACE</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} title="Close"><X size={19} /></button></div><form onSubmit={onSubmit} className="ticket-form"><label>Subject<input required maxLength="160" value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} placeholder="What can we help with?" /></label><label>Details<textarea required maxLength="10000" rows="5" value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} placeholder="Share any details that might help us resolve this..." /></label><div className="form-row"><label>Category<select value={value.category} onChange={(event) => setValue({ ...value, category: event.target.value })}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Priority<select value={value.priority} onChange={(event) => setValue({ ...value, priority: event.target.value })}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></label></div>{editing && isAgent && <label>Status<select value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value })}>{STATUSES.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></label>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Submit ticket'} <ArrowRight size={16} /></button></div></form></section></div>
}

function TicketDetailPanel({ ticket, user, isAgent, agents, timeline, comment, setComment, busy, onClose, onEdit, onStatus, onPriority, onAssign, onComment, onDelete }) {
    return <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="ticket-drawer"><header className="drawer-header"><button className="back-button" onClick={onClose}><ArrowLeft size={17} /> All tickets</button><button className="icon-button" onClick={onClose} title="Close"><X size={18} /></button></header><div className="drawer-scroll"><div className="ticket-meta"><span className="ticket-id">TICKET #{String(ticket.id).padStart(4, '0')}</span><span className="meta-divider" /><span>Opened {dateLabel(ticket.createdAt)}</span></div><h2 className="drawer-title">{ticket.title}</h2><div className="drawer-badges"><Status value={ticket.status} /><Priority value={ticket.priority} /></div><div className="drawer-description">{ticket.description}</div><div className="detail-grid"><div><span>REQUESTER</span><div><span className="avatar avatar-mini avatar-coral">{initials(ticket.createdBy.name)}</span>{ticket.createdBy.name}</div></div><div><span>CATEGORY</span><strong>{ticket.category}</strong></div><div><span>ASSIGNED TO</span>{isAgent ? <select className="inline-select" disabled={busy} value={ticket.assignedAgent?.id || ''} onChange={(event) => onAssign(event.target.value)}><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select> : <strong>{ticket.assignedAgent?.name || 'Not assigned yet'}</strong>}</div><div><span>LAST UPDATED</span><strong>{dateLabel(ticket.updatedAt)}</strong></div></div>
      <div className="manage-row"><div><span className="eyebrow">MANAGE TICKET</span><div className="manage-controls">{isAgent && <label>Status<select disabled={busy} value={ticket.status} onChange={(event) => onStatus(event.target.value)}>{STATUSES.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></label>}<label>Priority<select disabled={busy} value={ticket.priority} onChange={(event) => onPriority(event.target.value)}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></label></div></div><div className="manage-actions"><button className="secondary-button" disabled={busy} onClick={onEdit}>Edit</button>{(isAgent || (ticket.createdBy.id === user.id && ticket.status === 'OPEN')) && <button className="delete-button" disabled={busy} onClick={onDelete}>Delete</button>}</div></div>
        <section className="timeline-section"><div className="timeline-heading"><h3>Conversation</h3><span>{timeline.length} updates</span></div><div className="timeline">{timeline.map((item) => <article className="timeline-item" key={`${item.kind}-${item.id}`}><span className={`timeline-marker ${item.kind}`}><i>{item.kind === 'comment' ? <MessageSquare size={13} /> : <Activity size={13} />}</i></span><div className="timeline-content"><div className="timeline-byline"><strong>{item.actor?.name || 'Relay'}</strong><span>{dateLabel(item.createdAt)}</span></div><p>{item.detail}</p></div></article>)}{!timeline.length && <div className="timeline-empty">No updates yet. Start the conversation below.</div>}</div></section></div><form className="comment-form" onSubmit={onComment}><span className="avatar avatar-mini avatar-olive">{initials(user.name)}</span><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a reply..." maxLength="5000" /><button title="Send reply" disabled={!comment.trim()}><Send size={17} /></button></form></aside></div>
}

export default App