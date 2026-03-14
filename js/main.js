import { auth, db } from "./firebase.js"
import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	onSnapshot,
	updateDoc,
	deleteDoc,
	doc,
	getDoc,
	setDoc,
	serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

async function fetchHtml(path) {
	const res = await fetch(path)
	if (!res.ok) throw new Error('Failed to load ' + path)
	return await res.text()
}

/* Modal utility
   showModal({type:'info'|'confirm', title, message, onConfirm})
*/
function createModal() {
		// Modal HTML is expected to be present in the page (index.html).
		// Do not create or inject modal markup from JS.
		return
}

function showModal({type='info', title='', message='', onConfirm=null, onClose=null}){
	// modal markup should exist in HTML; fallback to native dialogs if missing
	const backdrop = document.getElementById('modal-backdrop')
	if (!backdrop) {
		if (type === 'confirm') {
			const ok = confirm(message)
			if (typeof onConfirm === 'function') onConfirm(ok)
			return
		} else {
			alert(message)
			if (typeof onClose === 'function') onClose()
			return
		}
	}
	const titleEl = document.getElementById('modal-title')
	const bodyEl = document.getElementById('modal-body')
	const actions = document.getElementById('modal-actions')
	titleEl.textContent = title || (type==='confirm'? 'Xác nhận' : 'Thông báo')
	bodyEl.textContent = message
	actions.innerHTML = ''
	const ok = document.createElement('button')
	ok.textContent = type==='confirm'? 'Xác nhận' : 'Đóng'
	ok.className = 'btn'
	ok.addEventListener('click', ()=>{
		backdrop.style.display = 'none'
		if(type==='confirm'){
			if (typeof onConfirm === 'function') onConfirm(true)
		} else {
			if (typeof onClose === 'function') onClose()
		}
	})

	// preview wiring is attached in initControl where control DOM exists
	actions.appendChild(ok)
	if(type === 'confirm'){
		const cancel = document.createElement('button')
		cancel.textContent = 'Hủy'
		cancel.className = 'secondary'
		cancel.addEventListener('click', ()=>{
			backdrop.style.display = 'none'
			if(typeof onConfirm === 'function') onConfirm(false)
			if (typeof onClose === 'function') onClose()
		})
		actions.appendChild(cancel)
	}

	// allow clicking outside or pressing Escape to close
	backdrop.style.display = 'flex'
	function cleanupHandlers() {
		backdrop.onclick = null
		document.onkeydown = null
	}
	backdrop.onclick = (ev) => {
		if (ev.target === backdrop) {
			backdrop.style.display = 'none'
			if(type === 'confirm'){
				if(typeof onConfirm === 'function') onConfirm(false)
			} else {
				if(typeof onClose === 'function') onClose()
			}
			cleanupHandlers()
		}
	}
	document.onkeydown = (ev) => {
		if (ev.key === 'Escape') {
			backdrop.style.display = 'none'
			if(type === 'confirm'){
				if(typeof onConfirm === 'function') onConfirm(false)
			} else {
				if(typeof onClose === 'function') onClose()
			}
			cleanupHandlers()
		}
	}
}

// show a simple form modal for adding/editing a device
function showDeviceModal({mode='add', data=null, onSave=null}){
	const backdrop = document.getElementById('modal-backdrop')
	if (!backdrop) {
		// fallback to prompt
		const name = prompt('Tên thiết bị', data && data.name ? data.name : '')
		if (name && typeof onSave === 'function') onSave(name)
		return
	}
	const titleEl = document.getElementById('modal-title')
	const bodyEl = document.getElementById('modal-body')
	const actions = document.getElementById('modal-actions')
	titleEl.textContent = mode === 'edit' ? 'Sửa thiết bị' : 'Thêm thiết bị'
	bodyEl.innerHTML = `
		<label style="display:block;margin-bottom:8px;font-weight:600">Tên thiết bị</label>
		<input id="modal-device-name" placeholder="Tên thiết bị" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" value="${data && data.name ? (''+data.name).replace(/"/g,'&quot;') : ''}" />
	`
	actions.innerHTML = ''
	const save = document.createElement('button')
	save.className = 'btn'
	save.textContent = mode === 'edit' ? 'Lưu' : 'Thêm'
	const cancel = document.createElement('button')
	cancel.className = 'secondary'
	cancel.textContent = 'Hủy'

	let saving = false
	save.addEventListener('click', async () => {
		if (saving) return
		const nameInput = document.getElementById('modal-device-name')
		const val = nameInput ? nameInput.value.trim() : ''
		if (!val) {
			info('Vui lòng nhập tên thiết bị')
			return
		}
		try {
			saving = true
			save.disabled = true
			save.classList.add('loading')
			if (typeof onSave === 'function') await onSave(val)
			backdrop.style.display = 'none'
		} finally {
			saving = false
			save.disabled = false
			save.classList.remove('loading')
		}
	})
	cancel.addEventListener('click', ()=>{
		backdrop.style.display = 'none'
	})
	actions.appendChild(cancel)
	actions.appendChild(save)
	backdrop.style.display = 'flex'
}

// show user add/edit modal (uses global modal-backdrop)
function showUserModal({mode='add', data=null, onSave=null}){
	const backdrop = document.getElementById('modal-backdrop')
	if (!backdrop) {
		// fallback to prompts
		const name = prompt('Tên khách hàng', data && data.name ? data.name : '')
		const username = mode === 'add' ? prompt('Tên tài khoản', '') : (data && data.username ? data.username : '')
		const password = prompt('Mật khẩu', data && data.password ? data.password : '')
		if (name && (mode === 'edit' || username)) {
			if (typeof onSave === 'function') onSave({ name, username, password })
		}
		return
	}
	const titleEl = document.getElementById('modal-title')
	const bodyEl = document.getElementById('modal-body')
	const actions = document.getElementById('modal-actions')
	titleEl.textContent = mode === 'edit' ? 'Sửa tài khoản' : 'Thêm tài khoản'
	const uname = data && data.username ? escapeHtml(data.username) : ''
	const nameVal = data && data.name ? escapeHtml(data.name) : ''
	const phoneVal = data && (data.phone || data.mobile || data.sdt) ? escapeHtml(data.phone || data.mobile || data.sdt) : ''
	const emailVal = data && data.email ? escapeHtml(data.email) : ''
	bodyEl.innerHTML = `
		<label style="display:block;margin-bottom:8px">Tên khách hàng<br>
			<input id="modal-user-name" placeholder="Tên khách hàng" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" value="${nameVal}" />
		</label>
		<label style="display:block;margin-bottom:8px">Tên tài khoản<br>
			<input id="modal-user-username" placeholder="Tên tài khoản" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" value="${uname}" ${mode==='edit' ? 'readonly' : ''} />
		</label>
		<label style="display:block;margin-bottom:8px">Mật khẩu (để trống nếu không đổi)<br>
			<input id="modal-user-password" placeholder="Mật khẩu" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" value="" />
		</label>
		<label style="display:block;margin-bottom:8px">Số điện thoại<br>
			<input id="modal-user-phone" placeholder="SĐT" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" value="${phoneVal}" />
		</label>
		<label style="display:block;margin-bottom:8px">Email<br>
			<input id="modal-user-email" placeholder="Email" style="width:100%;padding:10px;border-radius:8px;border:1px solid #e6e9ef" value="${emailVal}" />
		</label>
	`
	actions.innerHTML = ''
	const cancel = document.createElement('button')
	cancel.className = 'secondary'
	cancel.textContent = 'Hủy'
	cancel.addEventListener('click', ()=> { backdrop.style.display = 'none' })
	const save = document.createElement('button')
	save.className = 'btn'
	save.textContent = mode === 'edit' ? 'Lưu' : 'Thêm'
	save.addEventListener('click', async () => {
		const name = document.getElementById('modal-user-name').value.trim()
		const username = document.getElementById('modal-user-username').value.trim()
		const password = document.getElementById('modal-user-password').value.trim()
		const phone = document.getElementById('modal-user-phone').value.trim()
		const email = document.getElementById('modal-user-email').value.trim()
		if (!name) { info('Vui lòng nhập tên khách hàng'); return }
		if (mode === 'add' && !username) { info('Vui lòng nhập tên tài khoản'); return }
		try {
			if (typeof onSave === 'function') await onSave({ name, username, password, phone, email })
			backdrop.style.display = 'none'
		} catch (e) {
			console.error('Failed to save user', e)
			info('Lỗi khi lưu tài khoản')
		}
	})
	actions.appendChild(cancel)
	actions.appendChild(save)
	// set role select value
	try { document.getElementById('modal-user-role').value = roleVal } catch(e) {}
	backdrop.style.display = 'flex'
}

// show a read-only modal with arbitrary HTML content
function showListModal({title='Danh sách', html=''}){
	const backdrop = document.getElementById('modal-backdrop')
	if (!backdrop) {
		alert(title + "\n" + (html.replace(/<[^>]+>/g, '') || ''))
		return
	}
	const titleEl = document.getElementById('modal-title')
	const bodyEl = document.getElementById('modal-body')
	const actions = document.getElementById('modal-actions')
	titleEl.textContent = title
	bodyEl.innerHTML = html
	actions.innerHTML = ''
	const close = document.createElement('button')
	close.className = 'btn'
	close.textContent = 'Đóng'
	close.addEventListener('click', () => { backdrop.style.display = 'none' })
	actions.appendChild(close)
	backdrop.style.display = 'flex'
}

// helper: replace native alert/confirm usage in this file
function info(msg, title='', cb){
	showModal({type:'info', title, message: msg, onClose: cb})
}

function confirmMsg(msg, title='', cb){
	showModal({type:'confirm', title, message: msg, onConfirm: cb})
}

// Helper: format a timestamp for local display (module scope)
function formatLocal(dt){
	try {
		return new Date(dt).toLocaleString()
	} catch (e) {
		return dt || ''
	}
}

// Helper: escape HTML for safe insertion into templates (module scope)
function escapeHtml(str){
	return String(str || '').replace(/[&<>"']/g, s=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s])
}

async function loadAndInit(path, initFn) {
	const app = document.getElementById('app')
	// clear any full-screen mode before loading
	document.body.classList.remove('full-screen')
	// clear display background class when navigating
	document.body.classList.remove('display-bg')
	app.innerHTML = await fetchHtml(path)
	// if this is the manage page, enable full-screen layout
	// if this is the manage or control page, enable full-screen layout
	if (path && (path.includes('manage.html') || path.includes('control.html'))) {
		document.body.classList.add('full-screen')
	}
	if (typeof initFn === 'function') initFn()
}

async function login(){

	const btn = document.getElementById('loginBtn')
	if (btn) {
		btn.disabled = true
		btn.classList.add('loading')
	}

	try {
		const username = document.getElementById("username").value
		const password = document.getElementById("password").value
		const modeEl = document.querySelector('input[name="loginMode"]:checked')
		const mode = modeEl ? modeEl.value : 'admin'

		const col = mode === 'display' ? 'subUsers' : 'users'

		const q = query(
			collection(db, col),
			where("username","==",username)
		)

		const snap = await getDocs(q)

		if(snap.empty){
			info("Sai tài khoản/mật khẩu")
			return
		}

		let user

		snap.forEach(d => {
			user = d.data()
			user.id = d.id
		})

		if(user.password !== password){
			info("Sai mật khẩu")
			return
		}

		// keep an in-memory reference as well
		user.mode = mode
		window.currentUser = user
		localStorage.setItem("user",JSON.stringify(user));
		info("Đăng nhập thành công", '', () => {
			const uname = (username || '').toString().trim().toLowerCase()
			if (uname === 'admin') {
				navigate('/admin')
				return
			}
			if (mode === 'display') navigate('/display')
			else {		
				localStorage.removeItem('adminViewUser')
				navigate('/manage')
			}
		})
	} finally {
		if (btn) {
			btn.disabled = false
			btn.classList.remove('loading')
		}
	}

}

function initLogin() {
	// Attach login handler to button
	const btn = document.getElementById('loginBtn')
	if (btn) btn.addEventListener('click', (e) => {
		e.preventDefault()
		login()
	})
}

function initAdmin() {
	// rooms removed from manage page
	const accountBtn = document.getElementById('accountBtn')
	const accountMenu = document.getElementById('accountMenu')
	const accountName = document.getElementById('accountName')
	const logoutBtn = document.getElementById('logoutBtn')

	// populate account name
	try {
		const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		if (stored) {
			const display = stored.name || stored.username || stored.email || 'Tài khoản'
			if (accountBtn) accountBtn.textContent = display
			if (accountName) accountName.textContent = display
			window.currentUser = stored
		}
	} catch (e) { /* ignore */ }

	// account menu toggles
	if (accountBtn && accountMenu) {
		accountBtn.addEventListener('click', (ev) => {
			ev.stopPropagation()
			accountMenu.classList.toggle('show')
		})
		// close when clicking outside
		document.addEventListener('click', (ev) => {
			if (!accountMenu.contains(ev.target) && ev.target !== accountBtn) {
				accountMenu.classList.remove('show')
			}
		})
	}

	if (logoutBtn) logoutBtn.addEventListener('click', () => {
		logout()
	})
	
	const table = document.getElementById('userTable')
	const page = document.querySelector('.page')
	if (!table || !page) return

	// only allow admin users to see this page
	try {
		const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		const isAdmin = stored && (stored.role === 'admin' || stored.username === 'admin' || stored.isAdmin)
		if (!isAdmin) {
			page.innerHTML = '<div class="card"><div class="empty">Chỉ dành cho tài khoản admin.</div></div>'
			return
		}
	} catch (e) {
		page.innerHTML = '<div class="card"><div class="empty">Chỉ dành cho tài khoản admin.</div></div>'
		return
	}

	// load users list and sort admin accounts to the top
	onSnapshot(collection(db, 'users'), snap => {
		table.innerHTML = ''

	// wire add user button (admin page)
	const addUserBtn = document.getElementById('addUserBtn')
		if (addUserBtn) addUserBtn.addEventListener('click', () => {
			showUserModal({ mode: 'add', data: null, onSave: async (val) => {
				try {
					// ensure username uniqueness
					const q = query(collection(db, 'users'), where('username', '==', val.username))
					const snap = await getDocs(q)
					if (!snap.empty) { info('Tên tài khoản đã tồn tại'); return }
					await addDoc(collection(db, 'users'), { username: val.username, password: val.password || '', name: val.name || '', phone: val.phone || '', email: val.email || 'user', createdAt: new Date().toISOString() })
					info('Thêm tài khoản thành công')
				} catch (e) { console.error('Failed to add user', e); info('Lỗi khi thêm tài khoản: ' + (e && e.message ? e.message : '')) }
			}})
		})
		const users = []
		snap.forEach(ds => {
			users.push({ id: ds.id, data: ds.data() || {} })
		})

		function isAdminAccount(u){
			if (!u) return false
			const uname = (u.username || '').toString().toLowerCase()
			return u.role === 'admin' || uname === 'admin' || u.isAdmin === true
		}

		// sort: admins first, then by username
		users.sort((a,b) => {
			const aAdmin = isAdminAccount(a.data)
			const bAdmin = isAdminAccount(b.data)
			if (aAdmin && !bAdmin) return -1
			if (!aAdmin && bAdmin) return 1
			const na = (a.data.username || '').toString().toLowerCase()
			const nb = (b.data.username || '').toString().toLowerCase()
			return na.localeCompare(nb)
		})

		let idx = 0
		users.forEach(uobj => {
			idx++
			const u = uobj.data || {}
			const dsid = uobj.id
			const tr = document.createElement('tr')
			const email = u.email || ''
			const username = u.username || ''
			const name = u.name || u.ownerName || ''
			const password = u.password || ''
			const phone = u.phone || u.mobile || u.sdt || ''

			const isAdminRow = (username === 'admin' ? true : false)

			tr.innerHTML = `
					<td>${idx}</td>
					<td>${escapeHtml(name)}</td>
					<td>${escapeHtml(username)}</td>
					<td>${escapeHtml(password)}</td>
					<td>${escapeHtml(phone)}</td>
					<td>${escapeHtml(email)}</td>
					<td>
						${isAdminRow ? '' : ('<button class="btn small view-btn" data-uid="' + dsid + '">Xem</button><div style="height:8px"></div>')}
						<button class="btn small edit-btn" data-uid="${dsid}">Sửa</button>
					</td>
			`
			const viewBtn = tr.querySelector('.view-btn')
			if (viewBtn) viewBtn.addEventListener('click', (ev) => {
				const uid = ev.currentTarget.getAttribute('data-uid')
				try { localStorage.setItem('adminViewUser', uid) } catch(e){}
				navigate('/manage')
			})
			const editBtn = tr.querySelector('.edit-btn')
			if (editBtn) editBtn.addEventListener('click', async (ev) => {
				const uid = ev.currentTarget.getAttribute('data-uid')
				// fetch latest user data
				try {
					const ud = await getDoc(doc(db, 'users', uid))
					const udata = ud.exists() ? ud.data() : {}
					showUserModal({ mode: 'edit', data: { id: uid, username: udata.username, name: udata.name, phone: udata.phone, email: udata.email }, onSave: async (val) => {
						try {
							const update = { name: val.name || '', phone: val.phone || '', email: val.email || '', role: val.role || 'user', updatedAt: new Date().toISOString() }
							if (val.password) update.password = val.password
							await updateDoc(doc(db, 'users', uid), update)
							info('Cập nhật tài khoản thành công')
						} catch(e) { console.error('Failed to update user', e); info('Lỗi khi cập nhật tài khoản: ' + (e && e.message ? e.message : '')) }
					}})
				} catch(e) { console.error(e); info('Không thể tải thông tin người dùng') }
			})
			table.appendChild(tr)
		})
	}, err => {
		console.error('Failed to load users', err)
		table.innerHTML = '<tr><td colspan="8">Không thể tải danh sách người dùng.</td></tr>'
	})
}

// render a device card (module scope to avoid scoping/TDZ issues)
function renderCard(id, d) {
	const deviceList = document.getElementById('deviceList')
	if (!deviceList) return
	const cardId = 'device-card-' + id
	let card = document.getElementById(cardId)
	if (!card) {
		card = document.createElement('div')
		card.id = cardId
		card.className = 'device-card'
		deviceList.appendChild(card)
	}
	card.innerHTML = ''
	const title = document.createElement('h4')
	title.textContent = d.name || 'Thiết bị'
	const meta = document.createElement('div')
	meta.className = 'meta'

	const roomsInfo = document.createElement('div')
	roomsInfo.className = 'rooms-info'
	roomsInfo.textContent = 'Số lượng phòng: ...'
	meta.appendChild(roomsInfo)

	// account info: show subUsername and default password when available
	const accountInfo = document.createElement('div')
	accountInfo.className = 'account-info'
	if (d && d.subUsername) {
		const accLine = document.createElement('div')
		accLine.textContent = 'Tài khoản: ' + (d.subUsername || '')
		const pwdLine = document.createElement('div')
		pwdLine.textContent = 'Mật khẩu: 123456'
		accountInfo.appendChild(accLine)
		accountInfo.appendChild(pwdLine)
	}
	meta.appendChild(accountInfo)

	const actions = document.createElement('div')
	actions.className = 'actions'

	const editBtn = document.createElement('button')
	editBtn.className = 'btn small'
	editBtn.textContent = 'Sửa'
	editBtn.addEventListener('click', () => {
		showDeviceModal({ mode: 'edit', data: { id, ...d }, onSave: async (name) => {
			try {
				const u = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
				if (u && u.id) {
					await updateDoc(doc(db, 'users', u.id, 'devices', id), { name, updatedAt: new Date().toISOString() })
				} else {
					await updateDoc(doc(db, 'devices', id), { name, updatedAt: new Date().toISOString() })
				}
				info('Cập nhật thiết bị thành công')
			} catch (err) {
				console.error(err)
				info('Lỗi khi cập nhật thiết bị')
			}
		}})
	})
	// view button: open control page for this device
	const viewBtn = document.createElement('button')
	viewBtn.className = 'btn small'
	viewBtn.textContent = 'Xem'
	viewBtn.addEventListener('click', () => {
		navigate('/control?deviceId=' + id)
	})
	actions.appendChild(viewBtn)
	actions.appendChild(editBtn)

	card.appendChild(title)
	card.appendChild(meta)
	card.appendChild(actions)
}

// Enforce mobile card limit: at most 12 items (2 columns x 6 rows) on narrow viewports
function applyMobileCardLimit() {
	try {
		const mq = window.matchMedia('(max-width: 480px)')
		const shouldLimit = mq.matches
		;['.device-cards', '.room-cards'].forEach(sel => {
			const container = document.querySelector(sel)
			if (!container) return
			const children = Array.from(container.children)
			if (!shouldLimit) {
				children.forEach(c => c.style.display = '')
				return
			}
			children.forEach((c, i) => {
				if (i >= 12) c.style.display = 'none'
				else c.style.display = ''
			})
		})
	} catch(e) { /* ignore */ }
}

// Watch for dynamic changes and re-apply mobile limit
try {
	const obsTargets = []
	const addIf = (sel) => { const el = document.querySelector(sel); if (el) obsTargets.push(el) }
	addIf('.device-cards'); addIf('.room-cards')
	if (obsTargets.length) {
		const mo = new MutationObserver(() => applyMobileCardLimit())
		obsTargets.forEach(t => mo.observe(t, { childList: true }))
		window.addEventListener('resize', applyMobileCardLimit)
		// initial apply
		setTimeout(applyMobileCardLimit, 200)
	}
} catch(e) { /* ignore */ }

// Force two columns on narrow viewports by setting inline style (overrides CSS rules)
function enforceTwoColumnsMobile() {
	try {
		const isMobile = window.innerWidth <= 480
		;['.device-cards', '.room-cards'].forEach(sel => {
			const el = document.querySelector(sel)
			if (!el) return
			if (isMobile) {
				el.style.setProperty('grid-template-columns', 'repeat(2, 1fr)', 'important')
				el.style.setProperty('overflow', 'hidden')
			} else {
				el.style.removeProperty('grid-template-columns')
				el.style.removeProperty('overflow')
			}
		})
	} catch(e) { /* ignore */ }
}

window.addEventListener('resize', () => { enforceTwoColumnsMobile(); applyMobileCardLimit() })
setTimeout(() => { enforceTwoColumnsMobile(); applyMobileCardLimit() }, 150)

async function initManage() {
	// rooms removed from manage page
	const accountBtn = document.getElementById('accountBtn')
	const accountMenu = document.getElementById('accountMenu')
	const accountName = document.getElementById('accountName')
	const logoutBtn = document.getElementById('logoutBtn')

	// populate account name
	try {
		const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		if (stored) {
			const display = stored.name || stored.username || stored.email || 'Tài khoản'
			if (accountBtn) accountBtn.textContent = display
			if (accountName) accountName.textContent = display
			window.currentUser = stored
		}
	} catch (e) { /* ignore */ }

	// account menu toggles
	if (accountBtn && accountMenu) {
		accountBtn.addEventListener('click', (ev) => {
			ev.stopPropagation()
			accountMenu.classList.toggle('show')
		})
		// close when clicking outside
		document.addEventListener('click', (ev) => {
			if (!accountMenu.contains(ev.target) && ev.target !== accountBtn) {
				accountMenu.classList.remove('show')
			}
		})
	}

	if (logoutBtn) logoutBtn.addEventListener('click', () => {
		logout()
	})

	// let uid = JSON.parse(localStorage.getItem('user').id || 'null')
	// localStorage.setItem('adminViewUser', uid)
	// Device management (modal-based)
	const addDeviceBtn = document.getElementById('addDevice')
	const deviceList = document.getElementById('deviceList')
	let editingDeviceId = null

	// helper: keep device cards ordered by device name
	function sortDeviceList() {
		if (!deviceList) return
		const cards = Array.from(deviceList.children).filter(c => c.classList && c.classList.contains('device-card'))
		cards.sort((a, b) => {
			const anEl = a.querySelector('h4')
			const bnEl = b.querySelector('h4')
			const an = (anEl && anEl.textContent || '').toString().toLowerCase()
			const bn = (bnEl && bnEl.textContent || '').toString().toLowerCase()
			return an.localeCompare(bn, 'vi')
		})
		cards.forEach(c => deviceList.appendChild(c))
	}

	if (addDeviceBtn) addDeviceBtn.addEventListener('click', (ev) => {
		ev.preventDefault()
		showDeviceModal({ mode: 'add', data: null, onSave: async (name) => {
			try {
				const current = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
				// determine override param (admin viewing another user's manage)
				const _paramsLocal = (function(){ const raw = location.hash.replace(/^#/, ''); const parts = raw.split('?'); return new URLSearchParams(parts[1] || '') })()
				const overrideLocal = _paramsLocal.get('id') || (function(){ try { return localStorage.getItem('adminViewUser') } catch(e){ return null } })()
				const isAdminCurrent = current && (current.role === 'admin' || current.username === 'admin' || current.isAdmin)
				let targetUserId = null
				if (overrideLocal && isAdminCurrent) targetUserId = overrideLocal
				else if (current && current.id) targetUserId = current.id
				if (targetUserId) {
					try {
						// determine owner username/name from target user
						let ownerUsername = null
						let ownerName = null
						try {
							const ud = await getDoc(doc(db, 'users', targetUserId))
							if (ud.exists()) {
								ownerUsername = ud.data().username || ('user' + targetUserId)
								ownerName = ud.data().name || ownerUsername
							}
						} catch(e) { /* ignore */ }
						ownerUsername = ownerUsername || (current && (current.username || current.email)) || ('user' + (targetUserId || ''))
						ownerName = ownerName || (current && (current.name || current.username)) || ownerUsername
						// create a sub-user entry and device under target user's devices
						let maxIndex = 0
						const qSub = query(collection(db, 'subUsers'), where('owner', '==', ownerUsername))
						const snapSub = await getDocs(qSub)
						snapSub.forEach(ds => {
							const su = ds.data() || {}
							const uname = su.username || ''
							const parts = uname.split('_')
							if (parts.length > 1) {
								const last = parseInt(parts[parts.length - 1], 10)
								if (!isNaN(last) && parts.slice(0, -1).join('_') === ownerUsername) {
									if (last > maxIndex) maxIndex = last
								}
							}
						})
						const nextIndex = maxIndex + 1
						const subUsername = `${ownerUsername}_${nextIndex}`
						await addDoc(collection(db, 'subUsers'), { username: subUsername, owner: ownerUsername, ownerName: ownerName, password: '123456', createdAt: new Date().toISOString() })
						await addDoc(collection(db, 'users', targetUserId, 'devices'), { name, subUsername, owner: ownerUsername, ownerName: ownerName, updatedAt: new Date().toISOString() })
						info('Thêm thiết bị vào tài khoản thành công')
					} catch (errInner) {
						console.error('Failed to create subUser or device', errInner)
						info('Lỗi khi thêm thiết bị')
					}
				} else {
					// fallback to global devices collection if no target user
					try {
						await addDoc(collection(db, 'devices'), { name, updatedAt: new Date().toISOString() })
						info('Thêm thiết bị thành công')
					} catch (e) {
						console.error(e)
						info('Lỗi khi thêm thiết bị')
					}
				}
			} catch (err) {
				console.error(err)
				info('Lỗi khi thêm thiết bị')
			}
		}})
	})

	// devices list: load per-user from users.devices if available (supports array of IDs or embedded objects)
	if (deviceList) {
		// clear previous listeners
		if (window.__deviceUnsubs) {
			window.__deviceUnsubs.forEach(u => typeof u === 'function' && u())
		}
		window.__deviceUnsubs = []
		deviceList.innerHTML = ''

		let stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		let userId = stored && stored.id ? stored.id : null
		let userDevices = stored && Array.isArray(stored.devices) ? stored.devices : null
		const isAdminUser = stored && (stored.role === 'admin' || stored.username === 'admin' || stored.isAdmin)

		// helper to update add button visibility based on admin status
		function updateAddBtnVisibility() {
			if (!addDeviceBtn) return
			if (isAdminUser) {
				addDeviceBtn.disabled = false
				addDeviceBtn.style.display = ''
			} else {
				addDeviceBtn.disabled = true
				addDeviceBtn.style.display = 'none'
			}
		}

		// allow overriding which account's devices to view via hash param `id`
		// or via localStorage `adminViewUser` (set by admin 'Xem' action)
		const _params = (function(){ const raw = location.hash.replace(/^#/, ''); const parts = raw.split('?'); return new URLSearchParams(parts[1] || '') })()
		const overrideUserId = _params.get('id') || (function(){ try { return localStorage.getItem('adminViewUser') } catch(e){ return null } })()
		if (overrideUserId) {
			userId = overrideUserId
			userDevices = null
		}

		// set add button visibility: only admins may add devices (including when viewing another account)
		updateAddBtnVisibility()


		if (userId) {
			// subscribe to user's devices subcollection; if empty, fall back to global `devices`
			const viewUserId = userId
			let viewUsername = null
			// if admin is viewing another account (override), try to resolve that user's username
			if (overrideUserId && overrideUserId !== (window.currentUser && window.currentUser.id)) {
				try {
					const ud = await getDoc(doc(db, 'users', viewUserId))
					if (ud.exists()) viewUsername = ud.data().username || ud.data().owner || null
				} catch(e) { /* ignore */ }
			} else {
				// viewing own account
				try { const s = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null'); if (s) viewUsername = s.username || null } catch(e) {}
			}

			const unsub = onSnapshot(collection(db, 'users', viewUserId, 'devices'), async snapshot => {
				// clear list first
				deviceList.innerHTML = ''
				if (!snapshot.empty) {
					const docs = []
					snapshot.forEach(ds => docs.push({ id: ds.id, data: ds.data() }))
					// sort by device name
					docs.sort((a, b) => ((a.data && a.data.name) || '').toString().localeCompare(((b.data && b.data.name) || '').toString(), 'vi'))
					docs.forEach(item => {
						renderCard(item.id, item.data)
						;(async () => {
							try {
								const roomsColl = collection(db, 'users', viewUserId, 'devices', item.id, 'rooms')
								const s = await getDocs(roomsColl)
								const cntEl = document.querySelector('#device-card-' + item.id + ' .rooms-info')
								if (cntEl) cntEl.textContent = 'Số lượng phòng: ' + s.size
							} catch (e) { /* ignore */ }
						})()
					})
					// ensure DOM order
					sortDeviceList()
				} else {
					// no devices under user's subcollection — try global devices matching owner or ownerId
					let found = false
					if (viewUsername) {
						try {
							const q = query(collection(db, 'devices'), where('owner', '==', viewUsername))
							const snap = await getDocs(q)
							if (!snap.empty) {
								const docs = []
								snap.forEach(ds => docs.push({ id: ds.id, data: ds.data() }))
								docs.sort((a, b) => ((a.data && a.data.name) || '').toString().localeCompare(((b.data && b.data.name) || '').toString(), 'vi'))
								docs.forEach(item => {
									renderCard(item.id, item.data)
									;(async () => {
										try {
											const roomsColl = collection(db, 'devices', item.id, 'rooms')
											const s = await getDocs(roomsColl)
											const cntEl = document.querySelector('#device-card-' + item.id + ' .rooms-info')
											if (cntEl) cntEl.textContent = 'Số lượng phòng: ' + s.size
										} catch(e){}
									})()
								})
								found = true
								// ensure DOM order
								sortDeviceList()
							}
						} catch(e) { /* ignore */ }
					}
					if (!found) {
						// try matching by ownerId field
						try {
							const q2 = query(collection(db, 'devices'), where('ownerId', '==', viewUserId))
							const snap2 = await getDocs(q2)
							if (!snap2.empty) {
								const docs2 = []
								snap2.forEach(ds => docs2.push({ id: ds.id, data: ds.data() }))
								docs2.sort((a, b) => ((a.data && a.data.name) || '').toString().localeCompare(((b.data && b.data.name) || '').toString(), 'vi'))
								docs2.forEach(item => {
									renderCard(item.id, item.data)
									;(async () => {
										try {
											const roomsColl = collection(db, 'devices', item.id, 'rooms')
											const s = await getDocs(roomsColl)
											const cntEl = document.querySelector('#device-card-' + item.id + ' .rooms-info')
											if (cntEl) cntEl.textContent = 'Số lượng phòng: ' + s.size
										} catch(e){}
									})()
								})
								found = true
								// ensure DOM order
								sortDeviceList()
							}
						} catch(e) { /* ignore */ }
					}
				}
			})
			window.__deviceUnsubs.push(unsub)
		} else if (userDevices && userDevices.length) {
			// legacy: if devices are IDs, listen per-device; if objects, render directly
			userDevices.forEach(dev => {
				if (typeof dev === 'string') {
					const dRef = doc(db, 'devices', dev)
					const unsub = onSnapshot(dRef, ds => {
						if (!ds.exists()) return
						renderCard(ds.id, ds.data())
						sortDeviceList()
							;(async () => {
								try {
									const roomsColl = collection(db, 'devices', ds.id, 'rooms')
									const s = await getDocs(roomsColl)
									const cntEl = document.querySelector('#device-card-' + ds.id + ' .rooms-info')
									if (cntEl) cntEl.textContent = 'Số lượng phòng: ' + s.size
								} catch (e) { /* ignore */ }
							})()
					})
					window.__deviceUnsubs.push(unsub)
				} else if (dev && dev.id) {
					const dRef = doc(db, 'devices', dev.id)
					const unsub = onSnapshot(dRef, ds => {
						if (!ds.exists()) return
						renderCard(ds.id, ds.data())
						sortDeviceList()
							;(async () => {
								try {
									const roomsColl = collection(db, 'devices', ds.id, 'rooms')
									const s = await getDocs(roomsColl)
									const cntEl = document.querySelector('#device-card-' + ds.id + ' .rooms-info')
									if (cntEl) cntEl.textContent = 'Số lượng phòng: ' + s.size
								} catch (e) { /* ignore */ }
							})()
					})
					window.__deviceUnsubs.push(unsub)
				} else if (typeof dev === 'object') {
					const tempId = 'embedded-' + Math.random().toString(36).slice(2,9)
					renderCard(tempId, dev)
					sortDeviceList()
				}
			})
		} else {
			// No logged-in user and no per-user devices available — do not load global devices
			deviceList.innerHTML = '<div class="empty">Vui lòng đăng nhập để xem thiết bị của bạn.</div>'
			if (addDeviceBtn) addDeviceBtn.disabled = true
			return
		}
	}
	// rooms logic removed from manage page
}

// Initialize control page (moved from html/control.html)
async function initControl(){
	// account UI (same behavior as initManage)
	const accountBtn = document.getElementById('accountBtn')
	const accountMenu = document.getElementById('accountMenu')
	const accountName = document.getElementById('accountName')
	const logoutBtn = document.getElementById('logoutBtn')

	try {
		const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		if (stored) {
			const display = stored.name || stored.username || stored.email || 'Tài khoản'
			if (accountBtn) accountBtn.textContent = display
			if (accountName) accountName.textContent = display
			window.currentUser = stored
		}
	} catch (e) { /* ignore */ }

	if (accountBtn && accountMenu) {
		accountBtn.addEventListener('click', (ev) => {
			ev.stopPropagation()
			accountMenu.classList.toggle('show')
		})
		document.addEventListener('click', (ev) => {
			if (!accountMenu.contains(ev.target) && ev.target !== accountBtn) {
				accountMenu.classList.remove('show')
			}
		})
	}
	if (logoutBtn) logoutBtn.addEventListener('click', () => { logout() })

	function getHashParams(){
		const raw = location.hash.replace(/^#/, '')
		const parts = raw.split('?')
		return new URLSearchParams(parts[1] || '')
	}


	// show selection modal for wallpapers/borders
	async function showSelectionModal(collectionName, title, currentLink, onSave) {
		const backdrop = document.getElementById('modal-backdrop')
		const titleEl = document.getElementById('modal-title')
		const bodyEl = document.getElementById('modal-body')
		const actions = document.getElementById('modal-actions')
		if (!backdrop || !titleEl || !bodyEl || !actions) {
			alert('Modal không sẵn sàng')
			return
		}
		titleEl.textContent = title || 'Chọn'
		bodyEl.innerHTML = '<div style="padding:8px">Đang tải...</div>'
		actions.innerHTML = ''
		backdrop.style.display = 'flex'
		try {
			const snap = await getDocs(collection(db, collectionName))
			if (snap.empty) {
				bodyEl.innerHTML = '<div class="empty">Không tìm thấy mục nào.</div>'
				const closeBtn = document.createElement('button')
				closeBtn.className = 'btn'
				closeBtn.textContent = 'Đóng'
				closeBtn.addEventListener('click', () => { backdrop.style.display = 'none' })
				actions.appendChild(closeBtn)
				return
			}
			// build sorted list
			const items = []
			snap.forEach(docSnap => {
				const d = docSnap.data() || {}
				const link = d.link || d.url || ''
				const name = d.name || docSnap.id || ''
				items.push({ name: name.toString(), link })
			})
			items.sort((a, b) => a.name.toString().localeCompare(b.name.toString(), 'vi'))
			const grid = document.createElement('div')
			grid.style.display = 'grid'
			grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))'
			grid.style.gap = '12px'
			grid.style.padding = '8px'
			let selected = currentLink || ''
			items.forEach(item => {
				const link = item.link || ''
				const name = item.name || ''
				const tile = document.createElement('label')
				tile.style.display = 'block'
				tile.style.borderRadius = '8px'
				tile.style.padding = '6px'
				tile.style.cursor = 'pointer'
				tile.style.border = '2px solid rgba(0,0,0,0.06)'
				const radio = document.createElement('input')
				radio.type = 'radio'
				radio.name = 'selectionItem'
				radio.value = link
				radio.dataset.name = name
				radio.style.display = 'none'
				if (link === selected) radio.checked = true
				const img = document.createElement('img')
				img.src = link
				img.alt = name
				img.style.width = '100%'
				img.style.height = '150px'
				img.style.objectFit = 'cover'
				img.style.borderRadius = '6px'
				const caption = document.createElement('div')
				caption.textContent = name
				caption.style.fontSize = '13px'
				caption.style.marginTop = '6px'
				tile.appendChild(radio)
				tile.appendChild(img)
				tile.appendChild(caption)
				// clicking image selects the item
				img.addEventListener('click', (ev) => {
					ev.stopPropagation()
					const inputs = bodyEl.querySelectorAll('input[name="selectionItem"]')
					inputs.forEach(i => i.checked = false)
					radio.checked = true
					selected = radio.value
					// highlight selection
					const tiles = grid.querySelectorAll('label')
					tiles.forEach(t => t.style.boxShadow = '')
					tile.style.boxShadow = '0 8px 20px rgba(2,6,23,0.12)'
				})
				// add a small "Xem" button next to caption to open image in new tab
				const viewBtn = document.createElement('button')
				viewBtn.textContent = 'Xem'
				viewBtn.className = 'btn'
				viewBtn.style.marginLeft = '8px'
				viewBtn.style.fontSize = '12px'
				viewBtn.addEventListener('click', (ev) => {
					ev.stopPropagation()
					if (link) window.open(link, '_blank')
				})
				caption.appendChild(viewBtn)
				tile.appendChild(caption)
				grid.appendChild(tile)
			})
			bodyEl.innerHTML = ''
			bodyEl.appendChild(grid)
			// actions
			const cancel = document.createElement('button')
			cancel.className = 'secondary'
			cancel.textContent = 'Hủy'
			cancel.addEventListener('click', () => { backdrop.style.display = 'none' })
			actions.appendChild(cancel)
			const save = document.createElement('button')
			save.className = 'btn'
			save.textContent = 'Lưu'
			save.addEventListener('click', async () => {
				const sel = bodyEl.querySelector('input[name="selectionItem"]:checked')
				const val = sel ? sel.value : selected
				const nameVal = sel ? (sel.dataset && sel.dataset.name ? sel.dataset.name : '') : ''
				try {
					if (typeof onSave === 'function') await onSave({ link: val, name: nameVal })
					backdrop.style.display = 'none'
				} catch (e) {
					console.error('Failed to save selection', e)
					alert('Lỗi khi lưu')
				}
			})
			actions.appendChild(save)
		} catch (e) {
			console.error('Failed to load selection items', e)
			bodyEl.innerHTML = '<div class="empty">Không thể tải dữ liệu.</div>'
			const closeBtn = document.createElement('button')
			closeBtn.className = 'btn'
			closeBtn.textContent = 'Đóng'
			closeBtn.addEventListener('click', () => { backdrop.style.display = 'none' })
			actions.appendChild(closeBtn)
		}
	}

	async function loadDeviceName(deviceId){
		try{
			const g = await getDoc(doc(db, 'devices', deviceId))
			if (g.exists()) return g.data().name || null
		}catch(e){ /* ignore */ }
		// check for admin-view override (owner passed via hash or stored in localStorage)
		try {
			const params = getHashParams()
			const overrideLocal = params.get('ownerId') || params.get('id') || (function(){ try { return localStorage.getItem('adminViewUser') } catch(e){ return null } })()
			if (overrideLocal) {
				try {
					const u = await getDoc(doc(db, 'users', overrideLocal, 'devices', deviceId))
					if (u.exists()) return u.data().name || null
				} catch(e) { /* ignore */ }
			}
		} catch(e) { /* ignore */ }
		try{
			const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
			if (stored && stored.id){
				const u = await getDoc(doc(db, 'users', stored.id, 'devices', deviceId))
				if (u.exists()) return u.data().name || null
			}
		}catch(e){ /* ignore */ }
		return null
	}

	// DOM
	const roomList = document.getElementById('roomList')
	const addRoomBtn = document.getElementById('addRoomBtn')
	const roomModal = document.getElementById('roomModal')
	const roomForm = document.getElementById('roomForm')
	const modalTitle = document.getElementById('modalTitle')
	const guestNameInput = document.getElementById('guestName')
	const roomNameInput = document.getElementById('roomName')
	const roomTimeInput = document.getElementById('roomTime')
	const cancelBtn = document.getElementById('cancelBtn')
    const statusRadios = document.getElementsByName('roomStatus')

	let rooms = []
	let editId = null

	let roomsCollRef = null
	let deviceParentRef = null

	function openModal(isEdit=false){
		if (!roomModal) return
		roomModal.style.display = 'flex'
		roomModal.setAttribute('aria-hidden','false')
		if (modalTitle) modalTitle.textContent = isEdit ? 'Sửa phòng' : 'Thêm phòng'
		if (!isEdit) {
			try {
				const radio = Array.from(statusRadios || []).find(x => x.value === 'no_guest')
				if (radio) radio.checked = true
			} catch(e){}
			if (typeof updateRequiredByStatus === 'function') updateRequiredByStatus()
		}
	}
	function closeModal(){
		if (!roomModal) return
		roomModal.style.display = 'none'
		roomModal.setAttribute('aria-hidden','true')
		if (roomForm) roomForm.reset()
		editId = null
	}

	if (addRoomBtn) addRoomBtn.addEventListener('click', ()=> openModal(false))
	if (cancelBtn) cancelBtn.addEventListener('click', closeModal)

	async function saveRoom({guest, name, time, status, deviceId}){
		if (!deviceId) return
		if (!roomsCollRef) return
		if (editId){
				await updateDoc(doc(roomsCollRef, editId), { guest, name, time, status })
		} else {
				await addDoc(roomsCollRef, { guest, name, time, status, createdAt: new Date().toISOString() })
		}
	}

	if (roomForm) roomForm.addEventListener('submit', async (e)=>{
		e.preventDefault()
		const guest = guestNameInput ? guestNameInput.value.trim() : ''
		const name = roomNameInput ? roomNameInput.value.trim() : ''
		let time = roomTimeInput ? roomTimeInput.value.trim() : ''
		const status = (function(){
			const r = Array.from(statusRadios || []).find(r=>r.checked)
			return r ? r.value : 'no_guest'
		})()
		// validation: if no guest, only name required; if has guest, guest+time+name required
		if (!name) return
		if (status === 'has_guest') {
			if (!guest || !time) { alert('Vui lòng nhập tên khách và thời gian'); return }
		} else {
			// if no guest, clear guest/time before saving
			if (guestNameInput) guestNameInput.value = guest || ''
			if (roomTimeInput) roomTimeInput.value = time || ''
			// ensure saved values are empty
			// leave inputs intact (hidden) so user can toggle back, but pass empty strings
		}
		try{
			const params = getHashParams()
			const deviceId = params.get('deviceId')
			// when status is no_guest, ensure guest/time saved as empty strings
			const saveGuest = status === 'no_guest' ? '' : guest
			const saveTime = status === 'no_guest' ? '' : time
			await saveRoom({guest: saveGuest, name, time: saveTime, status, deviceId})
			closeModal()
		}catch(err){
			console.error('Failed to save room', err)
			alert('Lỗi khi lưu phòng')
		}
	})

	// toggle required attributes based on status selection
	function updateRequiredByStatus() {
		const status = (Array.from(statusRadios || []).find(r=>r.checked) || {value:'no_guest'}).value
		if (status === 'has_guest') {
			if (guestNameInput) {
				guestNameInput.setAttribute('required','')
				if (guestNameInput.parentElement) guestNameInput.parentElement.style.display = ''
			}
			if (roomTimeInput) {
				roomTimeInput.setAttribute('required','')
				if (roomTimeInput.parentElement) roomTimeInput.parentElement.style.display = ''
			}
		} else {
			if (guestNameInput) {
				guestNameInput.removeAttribute('required')
				if (guestNameInput.parentElement) guestNameInput.parentElement.style.display = 'none'
			}
			if (roomTimeInput) {
				roomTimeInput.removeAttribute('required')
				if (roomTimeInput.parentElement) roomTimeInput.parentElement.style.display = 'none'
			}
		}
	}
	Array.from(statusRadios || []).forEach(r => r.addEventListener('change', updateRequiredByStatus))
	updateRequiredByStatus()



	function renderRooms(){
		if (!roomList) return
		roomList.innerHTML = ''
			// sort rooms by name (locale-aware)
			try {
				const coll = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })
				rooms.sort((a, b) => coll.compare((a.name || '').toString().trim(), (b.name || '').toString().trim()))
			} catch(e) { /* fallback: no-op */ }
			// Render each room as a card matching device style
			rooms.forEach(r => {
			const card = document.createElement('div')
			// include device-card class so styling matches manage page
			card.className = 'device-card room-card'

			// title
			const title = document.createElement('h4')
			title.textContent = r.name || 'Phòng'

			// meta
			const meta = document.createElement('div')
			meta.className = 'meta'
			const guestInfo = document.createElement('div')
			const timeInfo = document.createElement('div')
			// if room has no guest, show 'Phòng trống'
			if (r.status === 'no_guest' || !r.guest) {
				guestInfo.textContent = 'Phòng trống'
				guestInfo.className = 'room-empty'
			} else {
				guestInfo.textContent = 'Khách: ' + (r.guest || '')
				timeInfo.textContent = 'Thời gian: ' + (r.time || '')
			}
			meta.appendChild(guestInfo)
			if (timeInfo.textContent) meta.appendChild(timeInfo)

			// actions
			const actions = document.createElement('div')
			actions.className = 'actions'
			const editBtn = document.createElement('button')
			editBtn.className = 'btn small'
			editBtn.textContent = 'Sửa'
			const delBtn = document.createElement('button')
			delBtn.className = 'secondary small'
			delBtn.textContent = 'Xoá'
			actions.appendChild(editBtn)
			actions.appendChild(delBtn)

			// wire handlers
			editBtn.addEventListener('click', ()=>{
				editId = r.id
				if (guestNameInput) guestNameInput.value = r.guest || ''
				if (roomNameInput) roomNameInput.value = r.name || ''
				if (roomTimeInput) roomTimeInput.value = r.time || ''
				// set status radio (default based on existing status or guest presence)
				const statusVal = r.status || (r.guest ? 'has_guest' : 'no_guest')
				try {
					const radio = Array.from(statusRadios || []).find(x => x.value === statusVal)
					if (radio) radio.checked = true
				} catch(e){}
				if (typeof updateRequiredByStatus === 'function') updateRequiredByStatus()
				openModal(true)
			})
			delBtn.addEventListener('click', async ()=>{
				if(!confirm('Bạn có chắc muốn xoá phòng này?')) return
				try{
					if (roomsCollRef) await deleteDoc(doc(roomsCollRef, r.id))
				}catch(err){ console.error('Failed to delete room', err); alert('Lỗi khi xoá phòng') }
			})

			card.appendChild(title)
			card.appendChild(meta)
			card.appendChild(actions)
			roomList.appendChild(card)
		})
	}

	// subscribe to rooms for deviceId (as subcollection under device)
	const params = (function(){ const raw = location.hash.replace(/^#/, ''); const parts = raw.split('?'); return new URLSearchParams(parts[1] || '') })()
	const deviceId = params.get('deviceId')

	// wire wallpaper/border buttons (open selection modal and save link to device)
	const chooseWallpaperBtn = document.getElementById('chooseWallpaperBtn')
	const chooseBorderBtn = document.getElementById('chooseBorderBtn')
	async function resolveDeviceParentRef() {
		const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		const userId = stored && stored.id ? stored.id : null
		// allow admin override via hash param ownerId or localStorage.adminViewUser
		try {
			const params = getHashParams()
			const overrideLocal = params.get('ownerId') || params.get('id') || (function(){ try { return localStorage.getItem('adminViewUser') } catch(e){ return null } })()
			if (overrideLocal) {
				try {
					const userDev = await getDoc(doc(db, 'users', overrideLocal, 'devices', deviceId))
					if (userDev.exists()) return doc(db, 'users', overrideLocal, 'devices', deviceId)
				} catch(e) { /* ignore */ }
			}
		} catch(e) { /* ignore */ }
		try {
			if (userId) {
				const userDev = await getDoc(doc(db, 'users', userId, 'devices', deviceId))
				if (userDev.exists()) return doc(db, 'users', userId, 'devices', deviceId)
			}
		} catch (e) { /* ignore */ }
		return doc(db, 'devices', deviceId)
	}

	if (chooseWallpaperBtn) chooseWallpaperBtn.addEventListener('click', async () => {
		const devRef = await resolveDeviceParentRef()
		// get current value
		let cur = ''
		try { const ds = await getDoc(devRef); if (ds.exists()) cur = ds.data().wallpaperLink || '' } catch(e){}
		showSelectionModal('wallpapers', 'Chọn hình nền', cur, async (link) => {
			if (!link || !link.link) return
			try {
				// update device document with link + name
				await updateDoc(devRef, { wallpaperLink: link.link, wallpaperName: link.name || '' })
				// also save to global 'selected' doc
				try { await setDoc(doc(db, 'selected', 'wallpaper'), { name: link.name || '', link: link.link, updatedAt: serverTimestamp() }, { merge: true }) } catch(e){ console.warn('Failed to write selected wallpaper', e) }
				// update UI if present
				const selEl = document.getElementById('selectedWallpaper')
				if (selEl) selEl.querySelector('strong').textContent = link.name || link.link
				if (selEl) selEl.setAttribute('attr-link', link.link || '')
				info('Lưu hình nền thành công')
			} catch (e) { console.error(e); alert('Không thể lưu hình nền') }
		})
	})

	if (chooseBorderBtn) chooseBorderBtn.addEventListener('click', async () => {
		const devRef = await resolveDeviceParentRef()
		let cur = ''
		try { const ds = await getDoc(devRef); if (ds.exists()) cur = ds.data().borderLink || '' } catch(e){}
		showSelectionModal('borders', 'Chọn khung', cur, async (link) => {
			if (!link || !link.link) return
			try {
				await updateDoc(devRef, { borderLink: link.link, borderName: link.name || '' })
				try { await setDoc(doc(db, 'selected', 'border'), { name: link.name || '', link: link.link, updatedAt: serverTimestamp() }, { merge: true }) } catch(e){ console.warn('Failed to write selected border', e) }
				const selEl = document.getElementById('selectedBorder')
				if (selEl) selEl.querySelector('strong').textContent = link.name || link.link
				if (selEl) selEl.setAttribute('attr-link', link.link || '')
				info('Lưu khung thành công')
			} catch (e) { console.error(e); alert('Không thể lưu khung') }
		})
	})

	// determine whether device is under current user or global devices
	const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
	const currentUserId = stored && stored.id ? stored.id : null
	try{
		// allow admin override via hash param ownerId/id or localStorage.adminViewUser
		const params = getHashParams()
		const overrideLocal = params.get('ownerId') || params.get('id') || (function(){ try { return localStorage.getItem('adminViewUser') } catch(e){ return null } })()
		const viewUserId = overrideLocal || currentUserId
		if (viewUserId) {
			const userDev = await getDoc(doc(db, 'users', viewUserId, 'devices', deviceId))
			if (userDev.exists()) {
				roomsCollRef = collection(db, 'users', viewUserId, 'devices', deviceId, 'rooms')
				deviceParentRef = doc(db, 'users', viewUserId, 'devices', deviceId)
			}
		}
	}catch(e){ /* ignore */ }
	// fallback to global device path
	if (!roomsCollRef) {
		roomsCollRef = collection(db, 'devices', deviceId, 'rooms')
		deviceParentRef = doc(db, 'devices', deviceId)
	}

	// populate selected labels from device data if available
	try {
		if (deviceParentRef) {
			const ds = await getDoc(deviceParentRef)
			if (ds.exists()) {
				const data = ds.data() || {}
				const sW = document.getElementById('selectedWallpaper')
				const sB = document.getElementById('selectedBorder')
				if (sW) {
					sW.querySelector('strong').textContent = data.wallpaperName || data.wallpaperLink || '--'
					sW.setAttribute('attr-link', data.wallpaperLink || '')
				}
				if (sB) {
					sB.querySelector('strong').textContent = data.borderName || data.borderLink || '--'
					sB.setAttribute('attr-link', data.borderLink || '')
				}
			}
		}
	} catch(e){ /* ignore */ }

	// --- Preview modal wiring (attach after DOM is present) ---
	try {
		const previewBtn = document.getElementById('previewDisplayBtn')
		const previewBackdrop = document.getElementById('displayPreview')
		const previewRooms = document.getElementById('previewRooms')
		const closePreview = document.getElementById('closePreview')
		function buildPreviewRooms(container){
			if(!container) return
			container.innerHTML = ''
			for(let i=1;i<=12;i++){
				const room = document.createElement('div')
				room.className = 'room'
				room.style.minHeight = '120px'
				room.style.padding = '18px'
				// include extra text fields: guest name, time, and short description
				const isEmpty = (i % 2 === 0)
				const guestText = isEmpty ? 'Phòng trống' : 'Anh Bảnh'
				const timeText = isEmpty ? '' : '14:00 - 15:00'
				room.innerHTML = `
					<h2 style="color: black; margin-bottom: 0">VIP ${i}</h2>
					<div class="guest-name">${guestText}</div>
					<div class="room-time">${timeText}</div>
				`
				container.appendChild(room)
			}
		}

		if (previewBtn && previewBackdrop && previewRooms) {
			previewBtn.addEventListener('click', async () => {
				let wallpaperLink = ''
				let borderLink = ''
				const sWEl = document.getElementById('selectedWallpaper')
				const sBEl = document.getElementById('selectedBorder')
				if (sWEl) wallpaperLink = sWEl.getAttribute('attr-link') || ''
				if (sBEl) borderLink = sBEl.getAttribute('attr-link') || ''
				if (!wallpaperLink || !borderLink) {
					try {
						const ws = await getDoc(doc(db, 'selected', 'wallpaper'))
						if (ws && ws.exists() && !wallpaperLink) wallpaperLink = ws.data().link || ''
						const bs = await getDoc(doc(db, 'selected', 'border'))
						if (bs && bs.exists() && !borderLink) borderLink = bs.data().link || ''
					} catch(e) { console.warn('Failed to load selected assets', e) }
				}

				// apply wallpaper to preview card (so card shows wallpaper)
				const previewCard = previewBackdrop.querySelector('.preview-card')
				if (previewCard) {
					if (wallpaperLink) {
						previewCard.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.18)), url('${wallpaperLink}')`
						previewCard.style.backgroundSize = 'cover'
						previewCard.style.backgroundPosition = 'center'
						previewCard.style.color = '#fff'
					} else {
						// translucent white card when no wallpaper
						previewCard.style.background = 'rgba(255,255,255,0.96)'
						previewCard.style.backgroundImage = ''
						previewCard.style.color = ''
					}
				}

				buildPreviewRooms(previewRooms)
				if (borderLink) {
					const roomEls = previewRooms.querySelectorAll('.room')
					roomEls.forEach(r => {
						r.style.backgroundImage = `url('${borderLink}'), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,250,250,0.9))`
						r.style.backgroundRepeat = 'no-repeat, no-repeat'
						r.style.backgroundSize = '100% 100%, 100% 100%'
						r.style.backgroundPosition = 'center, center'
					})
				}

				function tick(){
					const el = document.getElementById('previewClock')
					if (!el) return
					const now = new Date()
					const dd = String(now.getDate()).padStart(2,'0')
					const mm = String(now.getMonth()+1).padStart(2,'0')
					const yyyy = now.getFullYear()
					const hh = String(now.getHours()).padStart(2,'0')
					const min = String(now.getMinutes()).padStart(2,'0')
					const ss = String(now.getSeconds()).padStart(2,'0')
					el.textContent = `${dd}/${mm}/${yyyy} + ${hh}:${min}:${ss}`
				}
				tick(); window._previewClockInterval = setInterval(tick,1000)
				previewBackdrop.style.display = 'flex'
			})
		}

		if (closePreview && previewBackdrop) {
			closePreview.addEventListener('click', () => {
				previewBackdrop.style.display = 'none'
				clearInterval(window._previewClockInterval)
			})
		}
	} catch(e) { /* ignore preview wiring errors */ }

	// show device name in title
	loadDeviceName(deviceId).then(deviceName => {
		const titleEl = document.querySelector('.manage-title')
		if (titleEl) titleEl.textContent = deviceName ? `Danh sách phòng — ${deviceName}` : 'Danh sách phòng — (Thiết bị)'
	})
	if (addRoomBtn) addRoomBtn.disabled = false

	onSnapshot(roomsCollRef, snap => {
		rooms = []
		snap.forEach(ds => rooms.push({ id: ds.id, ...ds.data() }))
		renderRooms()
	}, err => {
		console.error('rooms subscription failed', err)
		if (roomList) roomList.innerHTML = '<div class="empty">Không thể tải phòng.</div>'
	})
}

function logout() {
	localStorage.removeItem('user')
	window.currentUser = null
	navigate('/')
}

function initDisplay() {
	// clock
	const clockEl = document.getElementById('clock')
	const displayOwnerEl = document.getElementById('displayOwner')
	function updateClock() {
		const now = new Date()
		const time = now.toLocaleTimeString('vi-VN')
		const dd = String(now.getDate()).padStart(2, '0')
		const mm = String(now.getMonth() + 1).padStart(2, '0')
		const yyyy = now.getFullYear()
		const date = `${dd}/${mm}/${yyyy}`
		if (clockEl) clockEl.innerText = time + ' - ' + date
	}
	setInterval(updateClock, 1000)
	updateClock()

	// mark body to use display background when this view is active
	document.body.classList.add('display-bg')

	// show ownerName at top if available (sub-user or user)
	try {
		const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
		if (displayOwnerEl) {
			const ownerName = (stored && (stored.ownerName || stored.name || stored.username || stored.owner)) || 'Trang trình chiếu'
			displayOwnerEl.textContent = ownerName
		}
	} catch(e) { /* ignore */ }
	// settings
	const titleEl = document.getElementById('title')
	if (titleEl) {
		onSnapshot(doc(db, 'settings', 'display'), docSnap => {
			if (!docSnap.exists()) return
			const data = docSnap.data()
			if (data.theme) document.body.className = data.theme
			if (data.title) titleEl.childNodes[0].nodeValue = data.title
		})
	}
	// rooms
	const roomsContainer = document.getElementById('rooms')
	if (roomsContainer) {
		roomsContainer.innerHTML = ''
		let displayWallpaperLink = ''
		let displayBorderLink = ''
		function applyWallpaperToBody() {
			try {
				if (displayWallpaperLink) {
					document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.18)), url('${displayWallpaperLink}')`
					document.body.style.backgroundSize = 'cover'
					document.body.style.backgroundPosition = 'center'
					document.body.style.color = '#fff'
				} else {
					document.body.style.backgroundImage = ''
					document.body.style.color = ''
				}
			} catch(e) { /* ignore */ }
		}
		function applyBorderToRooms() {
			try {
				if (!displayBorderLink) return
				const els = document.querySelectorAll('.rooms .room')
				document.querySelectorAll && els.forEach && els.forEach(r => {
					try {
						r.style.backgroundImage = `url('${displayBorderLink}'), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,250,250,0.9))`
						r.style.backgroundRepeat = 'no-repeat, no-repeat'
						r.style.backgroundSize = '100% 100%, 100% 100%'
						r.style.backgroundPosition = 'center, center'
					} catch(e) { /* ignore per-element errors */ }
				})
			} catch(e) { /* ignore */ }
		}
		// subscribe to global selected assets so display updates when control saves
		try {
			const unsubSelW = onSnapshot(doc(db, 'selected', 'wallpaper'), ds => {
				displayWallpaperLink = (ds && ds.exists() && ds.data().link) ? ds.data().link : ''
				applyWallpaperToBody()
				try { renderDisplayRoomsFromMap() } catch(e) {}
			}, err => { /* ignore */ })
			const unsubSelB = onSnapshot(doc(db, 'selected', 'border'), ds => {
				displayBorderLink = (ds && ds.exists() && ds.data().link) ? ds.data().link : ''
				try { applyBorderToRooms() } catch(e) {}
				try { renderDisplayRoomsFromMap() } catch(e) {}
			}, err => { /* ignore */ })
			// store unsub so cleanup possible
			window.__displaySelectedUnsubs = [unsubSelW, unsubSelB]
		} catch(e) { /* ignore */ }
		;(async () => {
			try {
				const stored = window.currentUser || JSON.parse(localStorage.getItem('user') || 'null')
				// expect display login to store sub-user record with fields: username, owner
				const subUsername = stored && stored.username ? stored.username : null
				const ownerUsername = stored && (stored.owner || stored.ownerUsername) ? (stored.owner || stored.ownerUsername) : null
				if (!subUsername || !ownerUsername) {
					roomsContainer.innerHTML = '<div class="empty">Không có dữ liệu trình chiếu.</div>'
					return
				}

				// find owner user document by username
				const qOwner = query(collection(db, 'users'), where('username', '==', ownerUsername))
				const ownerSnap = await getDocs(qOwner)
				if (ownerSnap.empty) {
					roomsContainer.innerHTML = '<div class="empty">Không tìm thấy chủ thiết bị.</div>'
					return
				}
				const ownerDoc = ownerSnap.docs[0]
				const ownerId = ownerDoc.id
				const ownerData = ownerDoc.data() || {}
				if (displayOwnerEl) displayOwnerEl.textContent = ownerData.name || ownerData.username || ownerUsername

				// find devices under this owner that match subUsername
				const qDev = query(collection(db, 'users', ownerId, 'devices'), where('subUsername', '==', subUsername))
				const devSnap = await getDocs(qDev)
				if (devSnap.empty) {
					return
				}

				// subscribe to rooms for each matched device and merge results
				const roomsMap = new Map()
				const unsubs = []

				function renderDisplayRoomsFromMap() {
					roomsContainer.innerHTML = ''
					// numeric-aware collator so names like "vip 2" sort before "vip 10"
					const coll = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })
					const items = Array.from(roomsMap.values()).sort((a, b) => {
						const an = (a.name || '').toString().trim()
						const bn = (b.name || '').toString().trim()
						return coll.compare(an, bn)
					})
					items.forEach(r => {
						const room = document.createElement('div')
						room.className = 'room ' + (r.status || 'empty')
						const name = r.name || ''
						const guest = r.guest || ''
						const time = r.time || ''
						room.innerHTML = `\n<h2 style="color: black;">${name}</h2>\n<div class="guest-name">${guest || 'Phòng trống'}</div>\n<div class="room-time">${time}</div>\n`
						// apply border as room background if available
						try {
							if (displayBorderLink) {
								room.style.backgroundImage = `url('${displayBorderLink}'), linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,250,250,0.9))`
								room.style.backgroundRepeat = 'no-repeat, no-repeat'
								room.style.backgroundSize = '100% 100%, 100% 100%'
								room.style.backgroundPosition = 'center, center'
							}
						} catch(e) { /* ignore */ }
						roomsContainer.appendChild(room)
					})
				}

				devSnap.forEach(devDoc => {
					const devId = devDoc.id
					const roomsCol = collection(db, 'users', ownerId, 'devices', devId, 'rooms')
					const unsub = onSnapshot(roomsCol, snap => {
						// refresh entries for this device
						// remove previous keys for this device
						for (const k of Array.from(roomsMap.keys())) {
							if (k.startsWith(devId + '::')) roomsMap.delete(k)
						}
						snap.forEach(ds => {
							roomsMap.set(devId + '::' + ds.id, { id: ds.id, ...ds.data() })
						})
						renderDisplayRoomsFromMap()
					}, err => {
						console.error('rooms subscription failed for device', devId, err)
					})
					unsubs.push(unsub)
				})

				// store unsubs so we can cleanup if needed
				window.__displayRoomUnsubs = unsubs

			} catch (e) {
				console.error('Failed to load display rooms', e)
				roomsContainer.innerHTML = '<div class="empty">Không thể tải phòng.</div>'
			}
		})()
	}

	// Floating action buttons: logout and fullscreen behavior
	try {
		const logoutFab = document.getElementById('displayLogoutBtn')
		const fsFab = document.getElementById('displayFullscreenBtn')
		if (logoutFab) logoutFab.addEventListener('click', () => { logout() })
		if (fsFab) fsFab.addEventListener('click', async () => {
			if (!document.fullscreenElement) {
				try { await document.documentElement.requestFullscreen(); document.body.classList.add('display-fullscreen') } catch(e) { console.error(e) }
			} else {
				try { await document.exitFullscreen(); document.body.classList.remove('display-fullscreen') } catch(e) { console.error(e) }
			}
		})
		document.addEventListener('fullscreenchange', () => {
			if (!document.fullscreenElement) document.body.classList.remove('display-fullscreen')
			else document.body.classList.add('display-fullscreen')
		})
	} catch(e) { /* ignore */ }
}

// Simple hash-based router (avoids server 404 on page refresh)
const routes = {
	'/': { path: './html/login.html', init: initLogin },
	'/admin': { path: './html/admin.html', init: initAdmin },
	'/manage': { path: './html/manage.html', init: initManage },
	'/display': { path: './html/display.html', init: initDisplay },
	'/control': { path: './html/control.html', init: initControl }
}

function navigate(to) {
	if (!to) to = '/'
	if (!to.startsWith('#')) location.hash = to
	else location.hash = to
}

function handleHash() {
	const raw = window.location.hash.replace(/^#/, '') || '/'
	const pathOnly = raw.split('?')[0]
	const route = routes[pathOnly] || routes['/']
	loadAndInit(route.path, route.init)
}

window.addEventListener('hashchange', handleHash)
// Auto-login: if `user` exists in localStorage, restore and navigate to /manage
function autoLoginFromStorage() {
	const raw = localStorage.getItem('user')
	if (!raw) return
	try {
		const user = JSON.parse(raw)
		if (user && (user.username || user.email)) {
			window.currentUser = user
			if (user.mode === 'display') navigate('/display')
			else if (user.username === 'admin') navigate('/admin')
			else navigate('/manage')
			return
		}
	} catch (e) {
		console.warn('Failed to parse stored user', e)
	}
}

autoLoginFromStorage()
// initial route
handleHash()
