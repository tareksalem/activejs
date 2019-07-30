/*
==============================
@param Activejs

Auther: Tarek Salem
Router module
==============================
 */
// dependencies
import URLPattern from "./url-pattern.js";
import ActiveHelpers from "./helpers.js";
import EventEmitter from "./EventEmitter.js";
import onChange from "./onchange";
var query = {};
window.location.search.substring(1).split('&').forEach(function (pair) {
    pair = pair.split('=');
    if (pair[1] !== undefined) {
        var key = decodeURIComponent(pair[0]),
            val = decodeURIComponent(pair[1]),
            val = val ? val.replace(/\++/g, ' ').trim() : '';
        if (key.length === 0) {
            return;
        }
        if (query[key] === undefined) {
            query[key] = val;
        } else {
            if ("function" !== typeof query[key].push) {
                query[key] = [query[key]];
            }
            query[key].push(val);
        }
    }
});

// define the router class
const routerObject = {
    classesRouters: {},
    bases: [],
    postBases: [],
    updateRequest: function (req) {
        req.query = query;
        req.href = window.location.href;
        req.origin = location.origin;
        req.search = location.search;
        req.hostname = location.hostname;
        req.port = location.port;
        req.hash = location.hash;
        req.host = location.host;
        req.url = location.pathname;
    },
    req: {
        pathname: window.location.pathname,
        validation: ActiveHelpers.validation
    },
    res: {},
    clickListener: function () {
        const self = this;
        self._emitter = self._emitter || new EventEmitter();
        // event listener
        document.addEventListener("click", (e) => {
            let links = document.querySelectorAll("a");
            links = Array.from(links).filter(link => link.getAttribute("router"));
            let link = Array.from(links).find(link => e.target == link);
            if (link) {
                e.preventDefault();
                if (e.detail === 1) {
                    let href = e.target.href;
                    let parsedUrl = new URL(href);
                    href = parsedUrl.pathname;
                    let requests = [];
                    history.pushState({
                        url: href,
                        title: e.target.getAttribute("title"),
                    }, e.target.title, href)
                    self.req.pathname = window.location.pathname;
                    self.req.url = window.location.pathname;
                    self._emitter.emit("change", self.req, self.res);
                    self.bases.map((base) => {
                        if (href.startsWith(base)) {
                            requests.push(base);
                        }
                    })
                    let matchedReq = requests[requests.length > 1 ? requests.length - 1 : 0];
                    if (matchedReq) {
                        self.updateRequest(self.req);
                        self.req.method = "get";
                        let matchedClass = this.classesRouters[matchedReq];
                        if (matchedClass) {
                            if (matchedClass.globalMiddleWares) {
                                if (matchedClass.globalMiddleWares.length > 0) {
                                    var nexted = 0;
                                    matchedClass.req = self.req;
                                    matchedClass.res = self.res;
                                    matchedClass.globalMiddleWares[0](self.req, self.res, next);

                                    function next() {
                                        nexted++;
                                        if (matchedClass.globalMiddleWares.length <= nexted) {
                                            matchedClass.init();
                                        } else {
                                            return matchedClass.globalMiddleWares[nexted](self.req, self.res, next);
                                        }
                                    }
                                } else {
                                    matchedClass.init();
                                }
                            } else {
                                matchedClass.init();
                            }
                        }
                    } else {
                        if (e.target.href.indexOf("#") == -1) {
                            self.res.statusCode = 404;
                            ActiveHelpers.logger({
                                type: "route",
                                method: self.req.method,
                                status: self.res.statusCode,
                                url: req.url,
                                time: Date.now()
                            });
                            return self.active.errorPage(self.req, self.res)
                        }
                    }
                }
            }
        })
    },
    Router: class {
        constructor(options) {
            this.base = options.base;
            routerObject.bases.push(this.base);
            routerObject.classesRouters[this.base] = this;
            this.getRouters = [];
            this.postRouters = [];
            this.inited = false;
            this.initedposts = false;
            this._emitter = new EventEmitter();
            this.on = this._emitter.on.bind(this._emitter);
            routerObject._emitter = this._emitter;
            routerObject.on = this._emitter.on
        }
        addRoute(options = new Object) {
            let handler = options.handler;
            let method = options.method.toLowerCase();
            let url = options.url.trim();
            let middleWares = options.middleWares;
            var setOptions = {
                handler,
                method,
                url,
                middleWares
            };
            if (method == "get") {
                this.getRouters.push(setOptions);
            } else if (method == "post" || method == "patch" || method == "put" || method == "delete") {
                this.postRouters.push(setOptions);
            }
        }
        init() {
            this.req = routerObject.req;
            this.res = routerObject.res;
            let req = this.req;
            let res = this.res;
            routerObject.updateRequest(req);
            let getRouters = this.getRouters;
            if (routerObject.req.method == "get") {
                if (this.inited == false) {
                    this.finalGetRouters = [];
                    this.getRouters.forEach((router) => {
                        router.url = `${this.base}/${router.url}`.replace(/(https?:\/\/)|(\/)+/g, "$1$2").replace(/^(.+?)\/*?$/, "$1");
                        router.method.toLowerCase();
                        let routePattern = new URLPattern(router.url);
                        routePattern.class = this;
                        let values = []
                        routePattern.ast.map((tag) => {
                            values.push(tag.value)
                        });
                        values = values.join("");
                        router.value = values.replace(/(https?:\/\/)|(\/)+/g, "$1$2").replace(/^(.+?)\/*?$/, "$1");
                        this.finalGetRouters.push(routePattern);
                    });
                    this.inited = true;
                }
                routerObject.req.pathname = location.pathname;
                routerObject.req.url = location.pathname;
                let matchedFinal;
                let matchedRe = routerObject.req.pathname;
                this.finalGetRouters.forEach((r) => {
                    matchedFinal = r.match(req.pathname);
                    if (matchedFinal) {
                        let values = [];
                        r.ast.map((tag) => {
                            values.push(tag.value)
                        });
                        values = values.join("");
                        matchedRe = values.replace(/(https?:\/\/)|(\/)+/g, "$1$2").replace(/^(.+?)\/*?$/, "$1");
                        req.params = matchedFinal;
                    }
                })
                let matchedURL = getRouters.find((router) => {
                    return router.value == matchedRe
                });
                if (matchedURL) {
                    routerObject.updateRequest(req);
                    if (matchedURL.method == "get") {
                        routerObject.res.statusCode = 200;
                        if (matchedURL.middleWares && matchedURL.middleWares.length > 0) {
                            var nexted = 0;
                            matchedURL.middleWares[0](routerObject.req, routerObject.res, next);

                            function next() {
                                nexted++;
                                if (matchedURL.middleWares.length <= nexted) {
                                    matchedURL.handler(routerObject.req, routerObject.res);
                                } else {
                                    return matchedURL.middleWares[nexted](routerObject.req, routerObject.res, next);
                                }
                            }
                        } else {
                            ActiveHelpers.logger({
                                type: "route",
                                method: routerObject.req.method,
                                status: routerObject.res.statusCode,
                                url: req.url,
                                time: Date.now()
                            });
                            matchedURL.handler(routerObject.req, routerObject.res);
                        }
                    } else {
                        routerObject.res.statusCode = 404;
                        ActiveHelpers.logger({
                            type: "route",
                            method: routerObject.req.method,
                            status: routerObject.res.statusCode,
                            url: req.url,
                            time: Date.now()
                        });
                        return this.errorPage ? this.errorPage(routerObject.req, routerObject.res) : routerObject.active.errorPage(routerObject.req, routerObject.res);
                    }
                } else {
                    routerObject.res.statusCode = 404;
                    ActiveHelpers.logger({
                        type: "route",
                        method: routerObject.req.method,
                        status: routerObject.res.statusCode,
                        url: req.url,
                        time: Date.now()
                    });
                    return this.errorPage ? this.errorPage(routerObject.req, routerObject.res) : routerObject.active.errorPage(routerObject.req, routerObject.res);
                }
            } else if (routerObject.req.method.toLowerCase() == "post" || routerObject.req.method.toLowerCase() == "patch" || routerObject.req.method.toLowerCase() == "put" || routerObject.req.method.toLowerCase() == "delete") {
                if (this.initedposts == false) {
                    this.finalPostRoutes = [];
                    this.postRouters.forEach((router) => {
                        router.url = `${this.base}/${router.url}`.replace(/(https?:\/\/)|(\/)+/g, "$1$2").replace(/^(.+?)\/*?$/, "$1");
                        router.method = router.method.toLowerCase();
                        let routePattern = new URLPattern(router.url);
                        routePattern.class = this;
                        let values = [];
                        routePattern.ast.map((tag) => {
                            values.push(tag.value)
                        });
                        values = values.join("");
                        router.value = values.replace(/(https?:\/\/)|(\/)+/g, "$1$2").replace(/^(.+?)\/*?$/, "$1");
                        this.finalPostRoutes.push(routePattern);
                    });
                    this.initedposts = true;
                }
                let matchedFinal;
                routerObject.req.url = routerObject.req.pathname;
                let matchedRe = routerObject.req.url;
                this.finalPostRoutes.forEach((r) => {
                    matchedFinal = r.match(routerObject.req.url);
                    if (matchedFinal) {
                        let values = [];
                        r.ast.map((tag) => {
                            values.push(tag.value)
                        });
                        values = values.join("");
                        matchedRe = values.replace(/(https?:\/\/)|(\/)+/g, "$1$2").replace(/^(.+?)\/*?$/, "$1");
                        req.params = matchedFinal;
                    }
                })
                let matchedURL = this.postRouters.find((router) => {
                    return router.value == matchedRe
                });
                if (matchedURL) {
                    if (matchedURL.method.toLowerCase() == "post" || matchedURL.method.toLowerCase() == "patch" || matchedURL.method.toLowerCase() == "put" || matchedURL.method.toLowerCase() == "delete") {
                        routerObject.res.statusCode = 200;
                        if (matchedURL.middleWares && matchedURL.middleWares.length > 0) {
                            var nexted = 0;
                            matchedURL.middleWares[0](routerObject.req, routerObject.res, next);

                            function next() {
                                nexted++;
                                if (matchedURL.middleWares.length <= nexted) {
                                    matchedURL.handler(routerObject.req, routerObject.res);
                                } else {
                                    return matchedURL.middleWares[nexted](routerObject.req, routerObject.res, next);
                                }
                            }
                        } else {
                            ActiveHelpers.logger({
                                type: "route",
                                method: routerObject.req.method,
                                status: routerObject.res.statusCode,
                                url: req.url,
                                time: Date.now()
                            });
                            matchedURL.handler(routerObject.req, routerObject.res);
                        }
                    } else {
                        routerObject.res.statusCode = 404;
                        ActiveHelpers.logger({
                            type: "route",
                            method: routerObject.req.method,
                            status: routerObject.res.statusCode,
                            url: req.url,
                            time: Date.now()
                        });
                        return this.errorPage ? this.errorPage(routerObject.req, routerObject.res) : routerObject.active.errorPage(routerObject.req, routerObject.res);
                    }
                } else {
                    routerObject.res.statusCode = 404;
                    ActiveHelpers.logger({
                        type: "route",
                        method: routerObject.req.method,
                        status: routerObject.res.statusCode,
                        url: req.url,
                        time: Date.now()
                    });
                    return this.errorPage ? this.errorPage(routerObject.req, routerObject.res) : routerObject.active.errorPage(routerObject.req, routerObject.res);
                }
            } else {
                routerObject.res.statusCode = 404;
                ActiveHelpers.logger({
                    type: "route",
                    method: routerObject.req.method,
                    status: routerObject.res.statusCode,
                    url: req.url,
                    time: Date.now()
                });
                return this.errorPage ? this.errorPage(routerObject.req, routerObject.res) : routerObject.active.errorPage(routerObject.req, routerObject.res);
            }
        }
        onRoute() {
            return new Promise((reslove, reject) => {})
        }
    },
    popState: function () {
        const self = this;
        let req = this.req;
        let res = this.res;
        self.updateRequest(req);
        window.addEventListener("popstate", (e) => {
            this.req.pathname = location.pathname;
            this.req.url = location.pathname;
            if (e.state) {
                let url = e.state.url;
                let requests = [];
                self.bases.map((base) => {
                    if (url.startsWith(base)) {
                        requests.push(base);
                    }
                })
                let matchedReq = requests[requests.length > 1 ? requests.length - 1 : 0];
                if (matchedReq) {
                    self.updateRequest(self.req);
                    self.req.method = "get";
                    let matchedClass = this.classesRouters[matchedReq];
                    if (matchedClass) {
                        if (matchedClass.globalMiddleWares) {
                            if (matchedClass.globalMiddleWares.length > 0) {
                                var nexted = 0;
                                matchedClass.req = self.req;
                                matchedClass.res = self.res;
                                matchedClass.globalMiddleWares[0](self.req, self.res, next);

                                function next() {
                                    nexted++;
                                    if (matchedClass.globalMiddleWares.length <= nexted) {
                                        matchedClass.init();
                                    } else {
                                        return matchedClass.globalMiddleWares[nexted](self.req, self.res, next);
                                    }
                                }
                            } else {
                                matchedClass.init();
                            }
                        } else {
                            matchedClass.init();
                        }
                    }
                } else {
                    self.res.statusCode = 404;
                    ActiveHelpers.logger({
                        type: "route",
                        method: self.req.method,
                        status: self.res.statusCode,
                        url: req.url,
                        time: Date.now()
                    });
                    return self.active.errorPage(self.req, self.res)
                }
            } else {
                self.res.statusCode = 404;
                ActiveHelpers.logger({
                    type: "route",
                    method: self.req.method,
                    status: self.res.statusCode,
                    url: req.url,
                    time: Date.now()
                });
                return self.active.errorPage(self.req, self.res)
            }
            self._emitter.emit("change", self.req, self.res);
        })
    },
    onload: function () {
        const self = this;
        window.addEventListener("load", () => {
            self.updateRequest(self.req);
            let parsedUrl = new URL(window.location.href);
            let href = parsedUrl.pathname;
            let requests = [];
            history.pushState({
                url: href,
                title: document.title,
            }, document.title, href)
            self.req.pathname = window.location.pathname;
            self.req.url = window.location.pathname;
            self._emitter.emit("change", self.req, self.res);
            self.bases.map((base) => {
                if (href.startsWith(base)) {
                    requests.push(base);
                }
            })
            let matchedReq = requests[requests.length > 1 ? requests.length - 1 : 0];
            if (matchedReq) {
                self.updateRequest(self.req);
                self.req.method = "get";
                let matchedClass = this.classesRouters[matchedReq];
                if (matchedClass) {
                    if (matchedClass.globalMiddleWares) {
                        if (matchedClass.globalMiddleWares.length > 0) {
                            var nexted = 0;
                            matchedClass.req = self.req;
                            matchedClass.res = self.res;
                            matchedClass.globalMiddleWares[0](self.req, self.res, next);

                            function next() {
                                nexted++;
                                if (matchedClass.globalMiddleWares.length <= nexted) {
                                    matchedClass.init();
                                } else {
                                    return matchedClass.globalMiddleWares[nexted](self.req, self.res, next);
                                }
                            }
                        } else {
                            matchedClass.init();
                        }
                    } else {
                        matchedClass.init();
                    }
                }
            } else {
                self.res.statusCode = 404;
                ActiveHelpers.logger({
                    type: "route",
                    method: self.req.method,
                    status: self.res.statusCode,
                    url: req.url,
                    time: Date.now()
                });
                return self.active.errorPage(self.req, self.res)
            }
        })
    },
    // method for submitting forms
    submitForms: function () {
        const self = this;
        document.addEventListener("submit", function (e) {
            // try {
            if (e.target.getAttribute("clientPosting") === "true") {
                var submitionCount = 0;
                e.preventDefault();
                var data = {};
                e.target.method = e.target.method.toLowerCase();
                data.form = e.target;
                self.req.action = data.form.action;
                var inputs = data.form.querySelectorAll("input");
                var textarea = data.form.querySelectorAll("textarea");
                var selects = data.form.querySelectorAll("select");
                selects.forEach(function (select, i) {
                    if (select.length > 0) {
                        var name = select.getAttribute("name");
                        data[name] = select;
                    }
                });
                inputs.forEach(function (input, i) {
                    if (inputs.length > 0) {
                        var name = input.getAttribute("name");
                        data[name] = input;
                    }
                });
                textarea.forEach((area, i) => {
                    if (textarea.length > 0) {
                        var textareaName = area.getAttribute("name");
                        data[textareaName] = area;
                    }
                })
                var act = new RegExp(location.origin, "gi");
                act = act.exec(self.req.action);
                var action = self.req.action.replace(act, "");
                let requests = [];
                self.bases.map((base) => {
                    if (action.startsWith(base)) {
                        requests.push(base);
                    }
                })
                let matchedReq = requests[requests.length > 1 ? requests.length - 1 : 0];
                if (matchedReq) {
                    self.req.data = data;
                    self.req.method = e.target.getAttribute("method") ? e.target.getAttribute("method").toLowerCase() !== "get" ? e.target.getAttribute("method").toLowerCase() : "post" : "post";
                    routerObject.req.action = action;
                    routerObject.req.url = action;
                    routerObject.req.pathname = action;
                    let matchedClass = self.classesRouters[matchedReq];
                    if (matchedClass) {
                        if (matchedClass.globalMiddleWares) {
                            if (matchedClass.globalMiddleWares.length > 0) {
                                var nexted = 0;
                                matchedClass.req = self.req;
                                matchedClass.res = self.res;
                                matchedClass.globalMiddleWares[0](self.req, self.res, next);

                                function next() {
                                    nexted++;
                                    if (matchedClass.globalMiddleWares.length <= nexted) {
                                        matchedClass.init();
                                    } else {
                                        return matchedClass.globalMiddleWares[nexted](self.req, self.res, next);
                                    }
                                }
                            } else {
                                matchedClass.init();
                            }
                        } else {
                            matchedClass.init();
                        }
                    }
                } else {
                    self.res.statusCode = 404;
                    ActiveHelpers.logger({
                        type: "route",
                        method: self.req.method,
                        status: self.res.statusCode,
                        url: req.url,
                        time: Date.now()
                    });
                    return self.active.errorPage(self.req, self.res)
                }

            }
        });
    }
}
export default routerObject;