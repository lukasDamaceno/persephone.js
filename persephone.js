class Persephone {
    constructor(aditionalErrorCodes = [], errorsWhitelist = []) {
        this.errorStatuses = [0, 400, 401, 403, 404, 405, 500, 502, 503]
    }

    addErrorsToList = (aditionalErrorCodes) => {
        this.errorStatuses.push(...aditionalErrorCodes)
    }

    removeErrorsFromList = (errorsWhitelist) => {
        this.errorStatuses.filter((v) => {
            return errorsWhitelist.indexOf(v) !== -1
        })
    }

    isStatusCodeValid = () => {
        return this.errorStatuses.indexOf(this.statusCode) === -1
    }

    get = async (url, options = {}) => {
        return this.fetch(url, 'GET', options)
    }

    post = async (url, options = {}) => {
        return this.fetch(url, 'POST', options)
    }

    fetch = async (url = '/', method = 'GET', options) => {
        try {
            let req = new PersephoneRequest(url, method)
            return req.openConnectionAndSendRequest(this.onErrorCallback, this.onLoadCallback)
        } catch (error) {
            throw error
        }
    }

    onErrorCallback(error, reject) {
        reject(new PersephoneError('xhrError', {}, 0, error))
    }

    onLoadCallback = (req, resolve, reject) => {
        let response = req.getResponse()
        if (!this.isStatusCodeValid(response.statusCode)) {
            reject(response)
        } else {
            resolve(response)
        }
    }
}

class PersephoneRequest {
    constructor(url, method, headers = {}, body = '') {
        this.url = url
        this.method = method
        this.headers = headers
        this._xhr = new XMLHttpRequest()
        this._xhr.onreadystatechange = this.xhrStateChangeEventCatcher

        this.readyStateNames = [
            'UNSENT',
            'OPENED',
            'HEADERS_RECEIVED',
            'LOADING',
            'DONE'
        ]
        this.readyState = this.updateReadyState()
        this.statusCode = this.updateStatusCode()
        this.body = body
    }

    updateReadyState() {
        this.readyState = {
            'state': this._xhr.readyState,
            'name': this.readyStateNames[this._xhr.readyState]
        }
    }

    updateStatusCode() {
        this.statusCode = this._xhr.status
    }


    openConnectionAndSendRequest = (onErrorCallback, onLoadCallback) => {
        return new Promise((resolve, reject) => {
            try {
                try {
                    this._xhr.open(this.method, this.url)
                    this._xhr.send()
                } catch (error) {
                    console.log('hey dood')
                }
                this._xhr.onerror = function (error) { return onErrorCallback(error, reject) }
                this._xhr.onload = () => { return onLoadCallback(this, resolve, reject) }
            } catch (error) {
                reject(PersephoneError())
            }
        })
    }

    xhrStateChangeEventCatcher = async (e) => {
        this.updateReadyState()
        this.updateStatusCode()
    }

    getResponse = () => {
        if (this.readyState.name === 'DONE') {
            if (this.statusCode !== 0) {
                return new PersephoneResponse(this.statusCode, this._xhr.getAllResponseHeaders(), this._xhr.response, this.errorCodes)
            } else {
                throw PersephoneError('status_zero')
            }
        }
    }
}

const _getContentType = new WeakMap()

class PersephoneResponse {
    constructor(statusCode, headers, body, errorStatuses) {
        this.statusCode = statusCode
        this.headers = this.parseHeaders(headers)
        this.body = body
        _getContentType.set(this, () => {
            return this.headers['content-type'] || 'text/plain'
        })
    }

    parseHeaders(headers) {
        let headersObj = {}
        let headersArr = headers.split(/\r\n/)
        headersArr.splice(-1, 1)

        for (let headerLine of headersArr) {
            headersObj[headerLine.match(/.*?(?=: )/)[0]] = headerLine.match(/(?<=: ).*/)[0]
        }
        return headersObj
    }

    json = () => {
        let getContentType = _getContentType.get(this)
        let contentType = getContentType()
        if (/^text\/json.*/.test(contentType) || /^text\/plain.*/.test(contentType) || /^application\/json.*/.test(contentType)) {
            try {
                return JSON.parse(this.body)
            } catch (error) {
                return this.body
            }
        } else return this.body
    }
}

class PersephoneError extends Error {
    constructor(message = 'unknown', response = {}, statusCode = "", xhrError) {
        super()
        this.messages = {
            'unknown': "Unknown Persephone error.",
            'statusZero': 'Erro: Requisição retornou status 0.',
            'notJson': 'Objeto não pode ser serializado como json',
            'xhrError': 'Erro no XHR'
        }
        this.name = "Persephone Error"
        this.level = "lel"
        this.message = this.messages[message] || this.messages.unknown
        this.toString = () => { return this.name + ": " + this.message; }
        this.response = response
        this.xhrError = xhrError || false
    }
}

export default Persephone