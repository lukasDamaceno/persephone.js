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

    isStatusCodeValid = (statusCode) => {
        return this.errorStatuses.indexOf(statusCode) === -1
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

    onErrorCallback(error, request, reject, event) {
        let perserr = new PersephoneError(event, {}, 0, error)
        reject(request.getResponse(perserr))
    }

    onLoadCallback = (request, resolve, reject) => {
        let response = request.getResponse()
        if (this.isStatusCodeValid(response.statusCode)) {
            resolve(response)
        } else {
            reject(response)
        }
    }
}

class PersephoneRequest {
    constructor(url, method, headers = {}, body = '', timeout = 10000) {
        this.url = url
        this.method = method
        this.headers = headers
        this.timeout = timeout

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
                this._xhr.timeout = this.timeout
                this._xhr.onload = () => { return onLoadCallback(this, resolve, reject) }
                this._xhr.ontimeout = (error) => { return onErrorCallback(error, this, reject, 'responseTimeout') }
                this._xhr.onabort = (error) => { return onErrorCallback(error, this, reject, 'abort') }
                this._xhr.onerror = (error) => { return onErrorCallback(error, this, reject, 'error') }
                try {
                    this._xhr.open(this.method, this.url)
                    this._xhr.send()
                } catch (error) {
                    console.log('hey dood')
                }
            } catch (error) {
                reject(PersephoneError())
            }
        })
    }

    xhrStateChangeEventCatcher = async (e) => {
        this.updateReadyState()
        this.updateStatusCode()
    }

    getResponse = (error = undefined) => {
        return new PersephoneResponse(this.statusCode, this._xhr.getAllResponseHeaders(), this._xhr.response, error)
    }
}

const _getContentType = new WeakMap()

class PersephoneResponse {
    constructor(statusCode, headers, body, error = undefined) {
        this.statusCode = statusCode
        this.headers = this.parseHeaders(headers)
        this.body = body
        _getContentType.set(this, () => {
            return this.headers['content-type'] || undefined
        })
        this.errorDetails = error
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
    constructor(type = 'unknown', response = {}, xhrError) {
        super()
        this.messages = {
            'unknown': "Unknown Persephone error.",
            'statusZero': 'Erro: Requisição retornou status 0.',
            'notJson': 'Objeto não pode ser serializado como json.',
            'error': 'Um erro interno na requisição impediu que a solicitação fosse enviada.',
            'responseTimeout': 'A resposta para solicitação excedeu o tempo limite.',
            'abort': 'A solicitação foi abortada durante o progresso.'
        }
        this.name = "Persephone Error"
        this.level = "lel"
        this.type = type
        this.message = this.messages[type] || this.messages.unknown
        this.toString = () => { return this.name + ": " + this.message; }
        this.response = response
        this.xhrError = xhrError || false
    }
}

export default Persephone