import RouteNode from 'route-node/modules/RouteNode'

let nameToIDs = name => {
    return name.split('.').reduce((ids, name) => {
        ids.push(ids.length ? ids[ids.length - 1] + '.' + name : name)
        return ids
    }, [])
}

let makeState = (name, params, path) => ({name, params, path})

export default class Router5 {
    constructor(routes, opts = {}) {
        this.started = false
        this.callbacks = {}
        this.lastStateAttempt = null
        this.lastKnownState = null
        this.rootNode  = routes instanceof RouteNode ? routes : new RouteNode('', '', routes)
        this.activeComponents = {}
        this.options = opts

        return this
    }

    add(routes) {
        this.rootNode.add(routes)
        return this
    }

    addNode(name, params) {
        this.rootNode.addNode(name, params)
        return this
    }

    onPopState(evt) {
        // Do nothing if no state or if last know state is poped state (it should never happen)
        if (!evt.state) return
        if (this.lastKnownState && this.areStatesEqual(evt.state, this.lastKnownState)) return

        let canTransition = this._transition(evt.state, this.lastKnownState)
        if (canTransition) this.lastKnownState = evt.state
    }

    start() {
        if (this.started) return this
        this.started = true

        // Try to match starting path name
        let startPath = this.options.useHash ? window.location.hash.replace(/^#/, '') : window.location.pathname
        let startMatch = this.rootNode.matchPath(startPath)

        if (startMatch) {
            this.lastKnownState = makeState(startMatch.name, startMatch.params, startPath)
            window.history.replaceState(this.lastKnownState, '', this.options.useHash ? `#${startPath}` : startPath)
        } else if (this.options.defaultRoute) {
            this.navigate(this.options.defaultRoute, this.options.defaultParams, {replace: true})
        }
        // Listen to popstate
        window.addEventListener('popstate', this.onPopState.bind(this))
        return this
    }

    stop() {
        if (!this.started) return this
        this.started = false

        window.removeEventListener('popstate', this.onPopState.bind(this))
        return this
    }

    _invokeCallbacks(name, newState, oldState) {
        if (!this.callbacks[name]) return
        this.callbacks[name].forEach(cb => {
            cb.call(this, newState, oldState)
        })
    }

    _transition(toState, fromState) {
        let cannotDeactivate = false

        if (fromState) {
            let i
            let fromStateIds = nameToIDs(fromState.name)
            let toStateIds   = nameToIDs(toState.name)

            let maxI = Math.min(fromStateIds.length, toStateIds.length)
            for (i = 0; i < maxI; i += 1) {
                if (fromStateIds[i] !== toStateIds[i]) break
            }

            cannotDeactivate =
                fromStateIds.slice(i).reverse()
                    .map(id => this.activeComponents[id])
                    .filter(comp => comp && comp.canDeactivate)
                    .some(comp => !comp.canDeactivate(toState, fromState))

            if (!cannotDeactivate && i > 0) this._invokeCallbacks(fromStateIds[i - 1], toState, fromState)
        }

        if (!cannotDeactivate) this._invokeCallbacks('', toState, fromState)
        return !cannotDeactivate
    }

    getState() {
        return this.lastKnownState
        // return window.history.state
    }

    areStatesEqual(state1, state2) {
        return state1.name === state2.name &&
           Object.keys(state1.params).length === Object.keys(state2.params).length &&
           Object.keys(state1.params).every(p => state1.params[p] === state2.params[p])
    }

    registerComponent(name, component) {
        if (this.activeComponents[name]) console.warn(`A component was alread registered for route node ${name}.`)
        this.activeComponents[name] = component
    }

    deregisterComponent(name) {
        delete this.activeComponents[name]
    }

    addNodeListener(name, cb) {
        if (name) {
            let segments = this.rootNode.getSegmentsByName(name)
            if (!segments) console.warn(`No route found for ${name}, listener could be never called!`)
        }
        if (!this.callbacks[name]) this.callbacks[name] = []
        this.callbacks[name].push(cb)
    }

    removeNodeListener(name, cb) {
        if (!this.callbacks[name]) return
        this.callbacks[name] = this.callbacks[name].filter(callback => callback !== cb)
    }

    addListener(cb) {
        this.addNodeListener('', cb)
    }

    removeListener(cb) {
        this.removeNodeListener('', cb)
    }

    buildPath(route, params) {
        return (this.options.useHash ? '#' : '') + this.rootNode.buildPath(route, params)
    }

    navigate(name, params = {}, opts = {}) {
        if (!this.started) return

        let path  = this.rootNode.buildPath(name, params)

        if (!path) throw new Error(`Could not find route "${name}"`)

        this.lastStateAttempt = makeState(name, params, path)
        let sameStates = this.lastKnownState ? this.areStatesEqual(this.lastKnownState, this.lastStateAttempt) : false

        // Do not proceed further if states are the same and no reload
        // (no desactivation and no callbacks)
        if (sameStates && !opts.reload) return

        // Transition and amend history
        let canTransition = this._transition(this.lastStateAttempt, this.lastKnownState)

        if (canTransition && !sameStates) {
            window.history[opts.replace ? 'replaceState' : 'pushState'](this.lastStateAttempt, '', this.options.useHash ? `#${path}` : path)
        }
        if (canTransition) {
            // Update lastKnowState
            this.lastKnownState = this.lastStateAttempt
        }
    }
}
