const vscode = require("vscode")
const axios = require("axios");

/**
 * @param {vscode.ExtensionContext} context
 */

let langTimeInterval = undefined
let sessionInterval = undefined
let sessionTimeItem = undefined
let languageProvider = undefined
let initialActiveEditor = undefined
let lastActiveEditor = undefined
let activeLangObject = {}
let savedLangs = []
let seconds = 0
let timePaused = false

const serverUrl = "http://localhost:3000"

class LanguageItem extends vscode.TreeItem {
	constructor(langId, seconds) {
		const item = `${langId}: ${formatTime(seconds)}`
		super(item, vscode.TreeItemCollapsibleState.None)
		this.tooltip = formatTime(seconds)
	}
}

class LanguageProvider {
	constructor(savedLangs) {
		let totalTime = 0

		this.times = savedLangs.map(element => {
			totalTime += element.time
			return new LanguageItem(element.id, element.time)
		})

		this.times.push(new LanguageItem("Total", totalTime))
	}

	getTreeItem(element) {
		return element
	}

	getChildren(element) {
		console.log(element)
		return Promise.resolve(this.times)
	}
}

function formatTime(ellapsedTimeS) {
	const days = Math.floor(ellapsedTimeS / 86400)
	const hours = Math.floor((ellapsedTimeS % 86400) / 3600)
	const minutes = Math.floor((ellapsedTimeS % 3600) / 60)
	const seconds = ellapsedTimeS % 60

	let ellapsedTimeForrmated = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`

	if (days > 0) {
		ellapsedTimeForrmated = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
	}

	return ellapsedTimeForrmated
}

function saveData(context) {
	context.globalState.update("langs", JSON.stringify(savedLangs))

	languageProvider = new LanguageProvider(savedLangs)
	vscode.window.createTreeView('view-lhc-data', { treeDataProvider: languageProvider })
}

function langTimeCounter() {
	clearInterval(langTimeInterval)
	if (vscode.window.activeTextEditor == undefined) {
		return
	}

	const activeLang = vscode.window.activeTextEditor.document.languageId
	activeLangObject = savedLangs.find(object => object.id === activeLang)

	langTimeInterval = setInterval(() => {
		activeLangObject.time++
		sessionTimeItem.text = formatTime(seconds)
	}, 1000)
}

function sessionTimeCounter() {
	clearInterval(sessionInterval)
	sessionInterval = setInterval(() => {
		seconds++
		sessionTimeItem.text = formatTime(seconds)
	}, 1000)
}

function daemon(context) {
	setInterval(() => {
		saveData(context)
	}, 1000)
}

function pauseTime() {
	clearInterval(sessionInterval)
	clearInterval(langTimeInterval)
}

function unpauseTime() {
	if (timePaused) {
		return
	}
	if (vscode.window.activeTextEditor == undefined) {
		return
	}

	langTimeCounter()
	sessionTimeItem.tooltip = "Pause session time"
	sessionTimeItem.text = formatTime(seconds)
}

function activate(context) {
	if (context.globalState.get("langs") == undefined) {
		context.globalState.update("langs", "[]")
	}
	savedLangs = JSON.parse(context.globalState.get("langs"))

	languageProvider = new LanguageProvider(savedLangs)
	vscode.window.createTreeView('view-lhc-data', { treeDataProvider: languageProvider })

	initialActiveEditor = vscode.window.activeTextEditor

	if (initialActiveEditor != undefined && vscode.window.state.focused) {
		langTimeCounter()
		sessionTimeCounter()
	}

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			saveData(context)

			if (vscode.window.activeTextEditor == undefined) {
				lastActiveEditor = undefined
				pauseTime()
				if (!timePaused) {
					sessionTimeItem.text = formatTime(seconds) + `$(clock)`
					sessionTimeItem.tooltip = "Time automatically paused"
				}
				return
			}

			if (lastActiveEditor == undefined && !timePaused) {
				sessionTimeCounter()
			}

			const langId = vscode.window.activeTextEditor.document.languageId
			const objetoEncontrado = savedLangs.find(object => object.id == langId)

			if (!objetoEncontrado) {
				savedLangs.push({ "id": langId, "time": 0 })
				saveData(context)
			}

			unpauseTime()
			lastActiveEditor = vscode.window.activeTextEditor.document.languageId
		})
	)

	context.subscriptions.push(vscode.window.onDidChangeWindowState(() => {
		if (!vscode.window.state.focused) {
			pauseTime()
			if (!timePaused) {
				sessionTimeItem.text = formatTime(seconds) + `$(clock)`
				sessionTimeItem.tooltip = "Time automatically paused"
			}
			return
		}

		if (!timePaused && vscode.window.activeTextEditor != undefined) {
			sessionTimeCounter()
		}

		unpauseTime()
	}))

	context.subscriptions.push(vscode.commands.registerCommand("lhc.toggleSessionCounter", () => {
		if (timePaused && vscode.window.activeTextEditor != undefined && vscode.window.state.focused) {
			timePaused = false
			sessionTimeCounter()
			unpauseTime()
			return
		}

		if (vscode.window.activeTextEditor == undefined && timePaused) {
			timePaused = false
			sessionTimeItem.text = formatTime(seconds) + `$(clock)`
			sessionTimeItem.tooltip = "Time automatically paused"
			return
		}

		timePaused = true
		pauseTime()

		sessionTimeItem.text = formatTime(seconds) + `$(debug-pause)`
		sessionTimeItem.tooltip = "Unpause session time"
	}))

	context.subscriptions.push(vscode.commands.registerCommand("lhc.clearHistory", () => {
		context.globalState.update("langs", "[]")

		savedLangs = JSON.parse(context.globalState.get("langs"))

		languageProvider = new LanguageProvider(savedLangs)
		vscode.window.createTreeView('view-lhc-data', { treeDataProvider: languageProvider })
	}))

	context.subscriptions.push(vscode.commands.registerCommand("lhc.authenticate", async () => {
		const secrets = context['secrets'];
		const token = await secrets.get('token'); 

		console.debug(token !== undefined)

		if(token !== undefined) {
			vscode.window.showInformationMessage("Ya estas logueado")
			return
		}

		const externalUrl = serverUrl + "/auth/google/vscode";
		vscode.env.openExternal(vscode.Uri.parse(externalUrl))
	}))

	context.subscriptions.push(vscode.commands.registerCommand("lhc.logout", async () => {
		const secrets = context['secrets'];
		await secrets.delete('token'); 

		vscode.window.showInformationMessage("Deslogueado correctamente")
	}))


	context.subscriptions.push(vscode.window.registerUriHandler({
		handleUri(uri) {
			const query = new URLSearchParams(uri.query);
			const token = query.get('token');

			if (!token) {
				vscode.window.showErrorMessage("Authentication error, try again!");
				return
			}

			const config = {
				headers: {
					Authorization: `Bearer ${token}`
				}
			};

			// @ts-ignore
			axios.get(`${serverUrl}/auth/vscode`, config)
				.then(async (response) => {
					console.debug(response.data)
					vscode.window.showInformationMessage(`Autenticado correctamente como ${response.data.email}`)

					const secrets = context['secrets'];
					await secrets.store('token', response.data.token);
				})
				.catch(error => {
					console.debug(error)
					vscode.window.showErrorMessage("Autenticación fallida, intentalo nuevamente")
				});
		}
	}))

	sessionTimeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
	sessionTimeItem.text = "00h 00m 00s" + `$(clock)`
	sessionTimeItem.tooltip = "Time automatically paused"
	sessionTimeItem.command = "lhc.toggleSessionCounter"

	sessionTimeItem.show()
	context.subscriptions.push(sessionTimeItem)

	daemon(context)
}

function deactivate(context) {
	saveData(context)
}

module.exports = {
	activate,
	deactivate
}