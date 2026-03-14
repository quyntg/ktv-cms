import "./firebase.js"

import { renderLogin } from "./pages/login.js"
import { renderAdmin } from "./pages/admin.js"
import { renderManage } from "./pages/manage.js"

page("/", renderLogin)

page("/admin", renderAdmin)

page("/manage", renderManage)

page()