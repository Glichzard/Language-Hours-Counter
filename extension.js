const { json } = require("stream/consumers")
const vscode = require("vscode")

/**
 * @param {vscode.ExtensionContext} context
 */

let sessionTimeItem
let seconds = 0
let timeCounter
let langTimeCounter
let timeCounterStopped = false
let langObject
let langId
let languageProvider

let savedLangs = []

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

function langCounter() {
	clearInterval(langTimeCounter)

	langObject = savedLangs.find(object => object.id === langId)

	langTimeCounter = setInterval(() => {
		langObject.time++
	}, 1000)
}

function sessionTimeCounter() {
	timeCounter = setInterval(() => {
		seconds++
		sessionTimeItem.text = formatTime(seconds)
	}, 1000)
}

function saveData(context) {
	const savedLangsPared = JSON.stringify(savedLangs)
	context.globalState.update("langs", savedLangsPared)

	languageProvider = new LanguageProvider(savedLangs)
	vscode.window.createTreeView('view-lhc-data', { treeDataProvider: languageProvider })
}

function daemon(context) {
	setInterval(() => {
		saveData(context)
	}, 5000)
}

function handlePause(context) {
	clearInterval(timeCounter)
	clearInterval(langTimeCounter)

	if (timeCounterStopped) {
		sessionTimeItem.text = formatTime(seconds)
		sessionTimeCounter()
		langCounter()
		sessionTimeItem.tooltip = "Pause session time"
		timeCounterStopped = false
		return
	}

	saveData(context)
	sessionTimeItem.text = formatTime(seconds) + `$(debug-pause)`
	sessionTimeItem.tooltip = "Unpause session time"
	timeCounterStopped = true
}

function activate(context) {
	if (context.globalState.get("langs") === undefined) {
		context.globalState.update("langs", "[]")
	}
	savedLangs = JSON.parse(context.globalState.get("langs"))

	languageProvider = new LanguageProvider(savedLangs)
	vscode.window.createTreeView('view-lhc-data', { treeDataProvider: languageProvider })

	langId = vscode.window.activeTextEditor.document.languageId

	context.subscriptions.push(vscode.commands.registerCommand("lhc.sessionTimeInfo", () => {
		vscode.window.showInformationMessage(savedLangs.join(", "))
	}))

	const toggleSessionCounter = vscode.commands.registerCommand("lhc.toggleSessionCounter", () => handlePause(context))
	context.subscriptions.push(toggleSessionCounter)

	sessionTimeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
	sessionTimeItem.text = "00h 00m 00s"
	sessionTimeItem.command = "lhc.toggleSessionCounter"
	sessionTimeItem.tooltip = "Pause session time"
	sessionTimeItem.show()
	sessionTimeCounter()

	context.subscriptions.push(sessionTimeItem)

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
		saveData(context)

		langId = vscode.window.activeTextEditor.document.languageId

		const objetosEncontrados = savedLangs.find(object => object.id == langId)

		if (!objetosEncontrados) {
			savedLangs.push({ "id": langId, "time": 0 })
		}

		if (timeCounterStopped) return
		langCounter()
	}))

	context.subscriptions.push(vscode.window.onDidChangeWindowState(() => {
		if (!vscode.window.state.focused) {
			saveData(context)
			timeCounterStopped = false
			handlePause(context)
			return
		}

		timeCounterStopped = true
		handlePause(context)
	}))

	daemon(context)
}

function deactivate(context) {
	saveData(context)
}

module.exports = {
	activate,
	deactivate
}
