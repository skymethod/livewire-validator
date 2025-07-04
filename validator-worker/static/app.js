// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `deno bundle` and it's not recommended to edit it manually

const directives = new WeakMap();
const isDirective = (o)=>{
    return typeof o === "function" && directives.has(o);
};
const isCEPolyfill = typeof window !== "undefined" && window.customElements != null && window.customElements.polyfillWrapFlushCallback !== void 0;
const reparentNodes = (container, start, end = null, before = null)=>{
    while(start !== end){
        const n = start.nextSibling;
        container.insertBefore(start, before);
        start = n;
    }
};
const removeNodes = (container, start, end = null)=>{
    while(start !== end){
        const n = start.nextSibling;
        container.removeChild(start);
        start = n;
    }
};
const noChange = {};
const nothing = {};
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
const nodeMarker = `<!--${marker}-->`;
const markerRegex = new RegExp(`${marker}|${nodeMarker}`);
const boundAttributeSuffix = "$lit$";
class Template {
    constructor(result, element){
        this.parts = [];
        this.element = element;
        const nodesToRemove = [];
        const stack = [];
        const walker = document.createTreeWalker(element.content, 133, null, false);
        let lastPartIndex = 0;
        let index = -1;
        let partIndex = 0;
        const { strings, values: { length } } = result;
        while(partIndex < length){
            const node = walker.nextNode();
            if (node === null) {
                walker.currentNode = stack.pop();
                continue;
            }
            index++;
            if (node.nodeType === 1) {
                if (node.hasAttributes()) {
                    const attributes = node.attributes;
                    const { length: length2 } = attributes;
                    let count = 0;
                    for(let i = 0; i < length2; i++){
                        if (endsWith(attributes[i].name, boundAttributeSuffix)) {
                            count++;
                        }
                    }
                    while(count-- > 0){
                        const stringForPart = strings[partIndex];
                        const name = lastAttributeNameRegex.exec(stringForPart)[2];
                        const attributeLookupName = name.toLowerCase() + boundAttributeSuffix;
                        const attributeValue = node.getAttribute(attributeLookupName);
                        node.removeAttribute(attributeLookupName);
                        const statics = attributeValue.split(markerRegex);
                        this.parts.push({
                            type: "attribute",
                            index,
                            name,
                            strings: statics
                        });
                        partIndex += statics.length - 1;
                    }
                }
                if (node.tagName === "TEMPLATE") {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
            } else if (node.nodeType === 3) {
                const data = node.data;
                if (data.indexOf(marker) >= 0) {
                    const parent = node.parentNode;
                    const strings2 = data.split(markerRegex);
                    const lastIndex = strings2.length - 1;
                    for(let i = 0; i < lastIndex; i++){
                        let insert;
                        let s = strings2[i];
                        if (s === "") {
                            insert = createMarker();
                        } else {
                            const match = lastAttributeNameRegex.exec(s);
                            if (match !== null && endsWith(match[2], boundAttributeSuffix)) {
                                s = s.slice(0, match.index) + match[1] + match[2].slice(0, -boundAttributeSuffix.length) + match[3];
                            }
                            insert = document.createTextNode(s);
                        }
                        parent.insertBefore(insert, node);
                        this.parts.push({
                            type: "node",
                            index: ++index
                        });
                    }
                    if (strings2[lastIndex] === "") {
                        parent.insertBefore(createMarker(), node);
                        nodesToRemove.push(node);
                    } else {
                        node.data = strings2[lastIndex];
                    }
                    partIndex += lastIndex;
                }
            } else if (node.nodeType === 8) {
                if (node.data === marker) {
                    const parent = node.parentNode;
                    if (node.previousSibling === null || index === lastPartIndex) {
                        index++;
                        parent.insertBefore(createMarker(), node);
                    }
                    lastPartIndex = index;
                    this.parts.push({
                        type: "node",
                        index
                    });
                    if (node.nextSibling === null) {
                        node.data = "";
                    } else {
                        nodesToRemove.push(node);
                        index--;
                    }
                    partIndex++;
                } else {
                    let i = -1;
                    while((i = node.data.indexOf(marker, i + 1)) !== -1){
                        this.parts.push({
                            type: "node",
                            index: -1
                        });
                        partIndex++;
                    }
                }
            }
        }
        for (const n of nodesToRemove){
            n.parentNode.removeChild(n);
        }
    }
}
const endsWith = (str, suffix)=>{
    const index = str.length - suffix.length;
    return index >= 0 && str.slice(index) === suffix;
};
const isTemplatePartActive = (part)=>part.index !== -1;
const createMarker = ()=>document.createComment("");
const lastAttributeNameRegex = /([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;
class TemplateInstance {
    constructor(template, processor, options){
        this.__parts = [];
        this.template = template;
        this.processor = processor;
        this.options = options;
    }
    update(values) {
        let i = 0;
        for (const part of this.__parts){
            if (part !== void 0) {
                part.setValue(values[i]);
            }
            i++;
        }
        for (const part of this.__parts){
            if (part !== void 0) {
                part.commit();
            }
        }
    }
    _clone() {
        const fragment = isCEPolyfill ? this.template.element.content.cloneNode(true) : document.importNode(this.template.element.content, true);
        const stack = [];
        const parts2 = this.template.parts;
        const walker = document.createTreeWalker(fragment, 133, null, false);
        let partIndex = 0;
        let nodeIndex = 0;
        let part;
        let node = walker.nextNode();
        while(partIndex < parts2.length){
            part = parts2[partIndex];
            if (!isTemplatePartActive(part)) {
                this.__parts.push(void 0);
                partIndex++;
                continue;
            }
            while(nodeIndex < part.index){
                nodeIndex++;
                if (node.nodeName === "TEMPLATE") {
                    stack.push(node);
                    walker.currentNode = node.content;
                }
                if ((node = walker.nextNode()) === null) {
                    walker.currentNode = stack.pop();
                    node = walker.nextNode();
                }
            }
            if (part.type === "node") {
                const part2 = this.processor.handleTextExpression(this.options);
                part2.insertAfterNode(node.previousSibling);
                this.__parts.push(part2);
            } else {
                this.__parts.push(...this.processor.handleAttributeExpressions(node, part.name, part.strings, this.options));
            }
            partIndex++;
        }
        if (isCEPolyfill) {
            document.adoptNode(fragment);
            customElements.upgrade(fragment);
        }
        return fragment;
    }
}
const policy = window.trustedTypes && trustedTypes.createPolicy("lit-html", {
    createHTML: (s)=>s
});
const commentMarker = ` ${marker} `;
class TemplateResult {
    constructor(strings, values, type, processor){
        this.strings = strings;
        this.values = values;
        this.type = type;
        this.processor = processor;
    }
    getHTML() {
        const l = this.strings.length - 1;
        let html2 = "";
        let isCommentBinding = false;
        for(let i = 0; i < l; i++){
            const s = this.strings[i];
            const commentOpen = s.lastIndexOf("<!--");
            isCommentBinding = (commentOpen > -1 || isCommentBinding) && s.indexOf("-->", commentOpen + 1) === -1;
            const attributeMatch = lastAttributeNameRegex.exec(s);
            if (attributeMatch === null) {
                html2 += s + (isCommentBinding ? commentMarker : nodeMarker);
            } else {
                html2 += s.substr(0, attributeMatch.index) + attributeMatch[1] + attributeMatch[2] + boundAttributeSuffix + attributeMatch[3] + marker;
            }
        }
        html2 += this.strings[l];
        return html2;
    }
    getTemplateElement() {
        const template = document.createElement("template");
        let value = this.getHTML();
        if (policy !== void 0) {
            value = policy.createHTML(value);
        }
        template.innerHTML = value;
        return template;
    }
}
class SVGTemplateResult extends TemplateResult {
    getHTML() {
        return `<svg>${super.getHTML()}</svg>`;
    }
    getTemplateElement() {
        const template = super.getTemplateElement();
        const content = template.content;
        const svgElement = content.firstChild;
        content.removeChild(svgElement);
        reparentNodes(content, svgElement.firstChild);
        return template;
    }
}
const isPrimitive = (value)=>{
    return value === null || !(typeof value === "object" || typeof value === "function");
};
const isIterable = (value)=>{
    return Array.isArray(value) || !!(value && value[Symbol.iterator]);
};
class AttributeCommitter {
    constructor(element, name, strings){
        this.dirty = true;
        this.element = element;
        this.name = name;
        this.strings = strings;
        this.parts = [];
        for(let i = 0; i < strings.length - 1; i++){
            this.parts[i] = this._createPart();
        }
    }
    _createPart() {
        return new AttributePart(this);
    }
    _getValue() {
        const strings = this.strings;
        const l = strings.length - 1;
        const parts2 = this.parts;
        if (l === 1 && strings[0] === "" && strings[1] === "") {
            const v = parts2[0].value;
            if (typeof v === "symbol") {
                return String(v);
            }
            if (typeof v === "string" || !isIterable(v)) {
                return v;
            }
        }
        let text = "";
        for(let i = 0; i < l; i++){
            text += strings[i];
            const part = parts2[i];
            if (part !== void 0) {
                const v = part.value;
                if (isPrimitive(v) || !isIterable(v)) {
                    text += typeof v === "string" ? v : String(v);
                } else {
                    for (const t of v){
                        text += typeof t === "string" ? t : String(t);
                    }
                }
            }
        }
        text += strings[l];
        return text;
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element.setAttribute(this.name, this._getValue());
        }
    }
}
class AttributePart {
    constructor(committer){
        this.value = void 0;
        this.committer = committer;
    }
    setValue(value) {
        if (value !== noChange && (!isPrimitive(value) || value !== this.value)) {
            this.value = value;
            if (!isDirective(value)) {
                this.committer.dirty = true;
            }
        }
    }
    commit() {
        while(isDirective(this.value)){
            const directive2 = this.value;
            this.value = noChange;
            directive2(this);
        }
        if (this.value === noChange) {
            return;
        }
        this.committer.commit();
    }
}
class NodePart {
    constructor(options){
        this.value = void 0;
        this.__pendingValue = void 0;
        this.options = options;
    }
    appendInto(container) {
        this.startNode = container.appendChild(createMarker());
        this.endNode = container.appendChild(createMarker());
    }
    insertAfterNode(ref) {
        this.startNode = ref;
        this.endNode = ref.nextSibling;
    }
    appendIntoPart(part) {
        part.__insert(this.startNode = createMarker());
        part.__insert(this.endNode = createMarker());
    }
    insertAfterPart(ref) {
        ref.__insert(this.startNode = createMarker());
        this.endNode = ref.endNode;
        ref.endNode = this.startNode;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        if (this.startNode.parentNode === null) {
            return;
        }
        while(isDirective(this.__pendingValue)){
            const directive2 = this.__pendingValue;
            this.__pendingValue = noChange;
            directive2(this);
        }
        const value = this.__pendingValue;
        if (value === noChange) {
            return;
        }
        if (isPrimitive(value)) {
            if (value !== this.value) {
                this.__commitText(value);
            }
        } else if (value instanceof TemplateResult) {
            this.__commitTemplateResult(value);
        } else if (value instanceof Node) {
            this.__commitNode(value);
        } else if (isIterable(value)) {
            this.__commitIterable(value);
        } else if (value === nothing) {
            this.value = nothing;
            this.clear();
        } else {
            this.__commitText(value);
        }
    }
    __insert(node) {
        this.endNode.parentNode.insertBefore(node, this.endNode);
    }
    __commitNode(value) {
        if (this.value === value) {
            return;
        }
        this.clear();
        this.__insert(value);
        this.value = value;
    }
    __commitText(value) {
        const node = this.startNode.nextSibling;
        value = value == null ? "" : value;
        const valueAsString = typeof value === "string" ? value : String(value);
        if (node === this.endNode.previousSibling && node.nodeType === 3) {
            node.data = valueAsString;
        } else {
            this.__commitNode(document.createTextNode(valueAsString));
        }
        this.value = value;
    }
    __commitTemplateResult(value) {
        const template = this.options.templateFactory(value);
        if (this.value instanceof TemplateInstance && this.value.template === template) {
            this.value.update(value.values);
        } else {
            const instance = new TemplateInstance(template, value.processor, this.options);
            const fragment = instance._clone();
            instance.update(value.values);
            this.__commitNode(fragment);
            this.value = instance;
        }
    }
    __commitIterable(value) {
        if (!Array.isArray(this.value)) {
            this.value = [];
            this.clear();
        }
        const itemParts = this.value;
        let partIndex = 0;
        let itemPart;
        for (const item of value){
            itemPart = itemParts[partIndex];
            if (itemPart === void 0) {
                itemPart = new NodePart(this.options);
                itemParts.push(itemPart);
                if (partIndex === 0) {
                    itemPart.appendIntoPart(this);
                } else {
                    itemPart.insertAfterPart(itemParts[partIndex - 1]);
                }
            }
            itemPart.setValue(item);
            itemPart.commit();
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            itemParts.length = partIndex;
            this.clear(itemPart && itemPart.endNode);
        }
    }
    clear(startNode = this.startNode) {
        removeNodes(this.startNode.parentNode, startNode.nextSibling, this.endNode);
    }
}
class BooleanAttributePart {
    constructor(element, name, strings){
        this.value = void 0;
        this.__pendingValue = void 0;
        if (strings.length !== 2 || strings[0] !== "" || strings[1] !== "") {
            throw new Error("Boolean attributes can only contain a single expression");
        }
        this.element = element;
        this.name = name;
        this.strings = strings;
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while(isDirective(this.__pendingValue)){
            const directive2 = this.__pendingValue;
            this.__pendingValue = noChange;
            directive2(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const value = !!this.__pendingValue;
        if (this.value !== value) {
            if (value) {
                this.element.setAttribute(this.name, "");
            } else {
                this.element.removeAttribute(this.name);
            }
            this.value = value;
        }
        this.__pendingValue = noChange;
    }
}
class PropertyCommitter extends AttributeCommitter {
    constructor(element, name, strings){
        super(element, name, strings);
        this.single = strings.length === 2 && strings[0] === "" && strings[1] === "";
    }
    _createPart() {
        return new PropertyPart(this);
    }
    _getValue() {
        if (this.single) {
            return this.parts[0].value;
        }
        return super._getValue();
    }
    commit() {
        if (this.dirty) {
            this.dirty = false;
            this.element[this.name] = this._getValue();
        }
    }
}
class PropertyPart extends AttributePart {
}
let eventOptionsSupported = false;
(()=>{
    try {
        const options = {
            get capture () {
                eventOptionsSupported = true;
                return false;
            }
        };
        window.addEventListener("test", options, options);
        window.removeEventListener("test", options, options);
    } catch (_e) {}
})();
class EventPart {
    constructor(element, eventName, eventContext){
        this.value = void 0;
        this.__pendingValue = void 0;
        this.element = element;
        this.eventName = eventName;
        this.eventContext = eventContext;
        this.__boundHandleEvent = (e)=>this.handleEvent(e);
    }
    setValue(value) {
        this.__pendingValue = value;
    }
    commit() {
        while(isDirective(this.__pendingValue)){
            const directive2 = this.__pendingValue;
            this.__pendingValue = noChange;
            directive2(this);
        }
        if (this.__pendingValue === noChange) {
            return;
        }
        const newListener = this.__pendingValue;
        const oldListener = this.value;
        const shouldRemoveListener = newListener == null || oldListener != null && (newListener.capture !== oldListener.capture || newListener.once !== oldListener.once || newListener.passive !== oldListener.passive);
        const shouldAddListener = newListener != null && (oldListener == null || shouldRemoveListener);
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        if (shouldAddListener) {
            this.__options = getOptions(newListener);
            this.element.addEventListener(this.eventName, this.__boundHandleEvent, this.__options);
        }
        this.value = newListener;
        this.__pendingValue = noChange;
    }
    handleEvent(event) {
        if (typeof this.value === "function") {
            this.value.call(this.eventContext || this.element, event);
        } else {
            this.value.handleEvent(event);
        }
    }
}
const getOptions = (o)=>o && (eventOptionsSupported ? {
        capture: o.capture,
        passive: o.passive,
        once: o.once
    } : o.capture);
class DefaultTemplateProcessor {
    handleAttributeExpressions(element, name, strings, options) {
        const prefix = name[0];
        if (prefix === ".") {
            const committer2 = new PropertyCommitter(element, name.slice(1), strings);
            return committer2.parts;
        }
        if (prefix === "@") {
            return [
                new EventPart(element, name.slice(1), options.eventContext)
            ];
        }
        if (prefix === "?") {
            return [
                new BooleanAttributePart(element, name.slice(1), strings)
            ];
        }
        const committer = new AttributeCommitter(element, name, strings);
        return committer.parts;
    }
    handleTextExpression(options) {
        return new NodePart(options);
    }
}
const defaultTemplateProcessor = new DefaultTemplateProcessor();
function templateFactory(result) {
    let templateCache = templateCaches.get(result.type);
    if (templateCache === void 0) {
        templateCache = {
            stringsArray: new WeakMap(),
            keyString: new Map()
        };
        templateCaches.set(result.type, templateCache);
    }
    let template = templateCache.stringsArray.get(result.strings);
    if (template !== void 0) {
        return template;
    }
    const key = result.strings.join(marker);
    template = templateCache.keyString.get(key);
    if (template === void 0) {
        template = new Template(result, result.getTemplateElement());
        templateCache.keyString.set(key, template);
    }
    templateCache.stringsArray.set(result.strings, template);
    return template;
}
const templateCaches = new Map();
const parts = new WeakMap();
const render = (result, container, options)=>{
    let part = parts.get(container);
    if (part === void 0) {
        removeNodes(container, container.firstChild);
        parts.set(container, part = new NodePart(Object.assign({
            templateFactory
        }, options)));
        part.appendInto(container);
    }
    part.setValue(result);
    part.commit();
};
if (typeof window !== "undefined") {
    (window["litHtmlVersions"] || (window["litHtmlVersions"] = [])).push("1.4.1");
}
const html = (strings, ...values)=>new TemplateResult(strings, values, "html", defaultTemplateProcessor);
const svg = (strings, ...values)=>new SVGTemplateResult(strings, values, "svg", defaultTemplateProcessor);
var _a;
window.JSCompiler_renameProperty = (prop, _obj)=>prop;
const defaultConverter = {
    toAttribute (value, type) {
        switch(type){
            case Boolean:
                return value ? "" : null;
            case Object:
            case Array:
                return value == null ? value : JSON.stringify(value);
        }
        return value;
    },
    fromAttribute (value, type) {
        switch(type){
            case Boolean:
                return value !== null;
            case Number:
                return value === null ? null : Number(value);
            case Object:
            case Array:
                return JSON.parse(value);
        }
        return value;
    }
};
const notEqual = (value, old)=>{
    return old !== value && (old === old || value === value);
};
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    hasChanged: notEqual
};
const STATE_HAS_UPDATED = 1;
const STATE_UPDATE_REQUESTED = 1 << 2;
const STATE_IS_REFLECTING_TO_ATTRIBUTE = 1 << 3;
const STATE_IS_REFLECTING_TO_PROPERTY = 1 << 4;
const finalized = "finalized";
class UpdatingElement extends HTMLElement {
    constructor(){
        super();
        this.initialize();
    }
    static get observedAttributes() {
        this.finalize();
        const attributes = [];
        this._classProperties.forEach((v, p)=>{
            const attr = this._attributeNameForProperty(p, v);
            if (attr !== void 0) {
                this._attributeToPropertyMap.set(attr, p);
                attributes.push(attr);
            }
        });
        return attributes;
    }
    static _ensureClassProperties() {
        if (!this.hasOwnProperty(JSCompiler_renameProperty("_classProperties", this))) {
            this._classProperties = new Map();
            const superProperties = Object.getPrototypeOf(this)._classProperties;
            if (superProperties !== void 0) {
                superProperties.forEach((v, k)=>this._classProperties.set(k, v));
            }
        }
    }
    static createProperty(name, options = defaultPropertyDeclaration) {
        this._ensureClassProperties();
        this._classProperties.set(name, options);
        if (options.noAccessor || this.prototype.hasOwnProperty(name)) {
            return;
        }
        const key = typeof name === "symbol" ? Symbol() : `__${name}`;
        const descriptor = this.getPropertyDescriptor(name, key, options);
        if (descriptor !== void 0) {
            Object.defineProperty(this.prototype, name, descriptor);
        }
    }
    static getPropertyDescriptor(name, key, options) {
        return {
            get () {
                return this[key];
            },
            set (value) {
                const oldValue = this[name];
                this[key] = value;
                this.requestUpdateInternal(name, oldValue, options);
            },
            configurable: true,
            enumerable: true
        };
    }
    static getPropertyOptions(name) {
        return this._classProperties && this._classProperties.get(name) || defaultPropertyDeclaration;
    }
    static finalize() {
        const superCtor = Object.getPrototypeOf(this);
        if (!superCtor.hasOwnProperty(finalized)) {
            superCtor.finalize();
        }
        this[finalized] = true;
        this._ensureClassProperties();
        this._attributeToPropertyMap = new Map();
        if (this.hasOwnProperty(JSCompiler_renameProperty("properties", this))) {
            const props = this.properties;
            const propKeys = [
                ...Object.getOwnPropertyNames(props),
                ...typeof Object.getOwnPropertySymbols === "function" ? Object.getOwnPropertySymbols(props) : []
            ];
            for (const p of propKeys){
                this.createProperty(p, props[p]);
            }
        }
    }
    static _attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false ? void 0 : typeof attribute === "string" ? attribute : typeof name === "string" ? name.toLowerCase() : void 0;
    }
    static _valueHasChanged(value, old, hasChanged = notEqual) {
        return hasChanged(value, old);
    }
    static _propertyValueFromAttribute(value, options) {
        const type = options.type;
        const converter = options.converter || defaultConverter;
        const fromAttribute = typeof converter === "function" ? converter : converter.fromAttribute;
        return fromAttribute ? fromAttribute(value, type) : value;
    }
    static _propertyValueToAttribute(value, options) {
        if (options.reflect === void 0) {
            return;
        }
        const type = options.type;
        const converter = options.converter;
        const toAttribute = converter && converter.toAttribute || defaultConverter.toAttribute;
        return toAttribute(value, type);
    }
    initialize() {
        this._updateState = 0;
        this._updatePromise = new Promise((res)=>this._enableUpdatingResolver = res);
        this._changedProperties = new Map();
        this._saveInstanceProperties();
        this.requestUpdateInternal();
    }
    _saveInstanceProperties() {
        this.constructor._classProperties.forEach((_v, p)=>{
            if (this.hasOwnProperty(p)) {
                const value = this[p];
                delete this[p];
                if (!this._instanceProperties) {
                    this._instanceProperties = new Map();
                }
                this._instanceProperties.set(p, value);
            }
        });
    }
    _applyInstanceProperties() {
        this._instanceProperties.forEach((v, p)=>this[p] = v);
        this._instanceProperties = void 0;
    }
    connectedCallback() {
        this.enableUpdating();
    }
    enableUpdating() {
        if (this._enableUpdatingResolver !== void 0) {
            this._enableUpdatingResolver();
            this._enableUpdatingResolver = void 0;
        }
    }
    disconnectedCallback() {}
    attributeChangedCallback(name, old, value) {
        if (old !== value) {
            this._attributeToProperty(name, value);
        }
    }
    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
        const ctor = this.constructor;
        const attr = ctor._attributeNameForProperty(name, options);
        if (attr !== void 0) {
            const attrValue = ctor._propertyValueToAttribute(value, options);
            if (attrValue === void 0) {
                return;
            }
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_ATTRIBUTE;
            if (attrValue == null) {
                this.removeAttribute(attr);
            } else {
                this.setAttribute(attr, attrValue);
            }
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_ATTRIBUTE;
        }
    }
    _attributeToProperty(name, value) {
        if (this._updateState & STATE_IS_REFLECTING_TO_ATTRIBUTE) {
            return;
        }
        const ctor = this.constructor;
        const propName = ctor._attributeToPropertyMap.get(name);
        if (propName !== void 0) {
            const options = ctor.getPropertyOptions(propName);
            this._updateState = this._updateState | STATE_IS_REFLECTING_TO_PROPERTY;
            this[propName] = ctor._propertyValueFromAttribute(value, options);
            this._updateState = this._updateState & ~STATE_IS_REFLECTING_TO_PROPERTY;
        }
    }
    requestUpdateInternal(name, oldValue, options) {
        let shouldRequestUpdate = true;
        if (name !== void 0) {
            const ctor = this.constructor;
            options = options || ctor.getPropertyOptions(name);
            if (ctor._valueHasChanged(this[name], oldValue, options.hasChanged)) {
                if (!this._changedProperties.has(name)) {
                    this._changedProperties.set(name, oldValue);
                }
                if (options.reflect === true && !(this._updateState & STATE_IS_REFLECTING_TO_PROPERTY)) {
                    if (this._reflectingProperties === void 0) {
                        this._reflectingProperties = new Map();
                    }
                    this._reflectingProperties.set(name, options);
                }
            } else {
                shouldRequestUpdate = false;
            }
        }
        if (!this._hasRequestedUpdate && shouldRequestUpdate) {
            this._updatePromise = this._enqueueUpdate();
        }
    }
    requestUpdate(name, oldValue) {
        this.requestUpdateInternal(name, oldValue);
        return this.updateComplete;
    }
    async _enqueueUpdate() {
        this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
        try {
            await this._updatePromise;
        } catch (e) {}
        const result = this.performUpdate();
        if (result != null) {
            await result;
        }
        return !this._hasRequestedUpdate;
    }
    get _hasRequestedUpdate() {
        return this._updateState & STATE_UPDATE_REQUESTED;
    }
    get hasUpdated() {
        return this._updateState & 1;
    }
    performUpdate() {
        if (!this._hasRequestedUpdate) {
            return;
        }
        if (this._instanceProperties) {
            this._applyInstanceProperties();
        }
        let shouldUpdate = false;
        const changedProperties = this._changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.update(changedProperties);
            } else {
                this._markUpdated();
            }
        } catch (e) {
            shouldUpdate = false;
            this._markUpdated();
            throw e;
        }
        if (shouldUpdate) {
            if (!(this._updateState & 1)) {
                this._updateState = this._updateState | STATE_HAS_UPDATED;
                this.firstUpdated(changedProperties);
            }
            this.updated(changedProperties);
        }
    }
    _markUpdated() {
        this._changedProperties = new Map();
        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
    }
    get updateComplete() {
        return this._getUpdateComplete();
    }
    _getUpdateComplete() {
        return this.getUpdateComplete();
    }
    getUpdateComplete() {
        return this._updatePromise;
    }
    shouldUpdate(_changedProperties) {
        return true;
    }
    update(_changedProperties) {
        if (this._reflectingProperties !== void 0 && this._reflectingProperties.size > 0) {
            this._reflectingProperties.forEach((v, k)=>this._propertyToAttribute(k, this[k], v));
            this._reflectingProperties = void 0;
        }
        this._markUpdated();
    }
    updated(_changedProperties) {}
    firstUpdated(_changedProperties) {}
}
_a = finalized;
UpdatingElement[_a] = true;
const ElementProto = Element.prototype;
ElementProto.msMatchesSelector || ElementProto.webkitMatchesSelector;
const supportsAdoptingStyleSheets = window.ShadowRoot && (window.ShadyCSS === void 0 || window.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
const constructionToken = Symbol();
class CSSResult {
    constructor(cssText, safeToken){
        if (safeToken !== constructionToken) {
            throw new Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
        }
        this.cssText = cssText;
    }
    get styleSheet() {
        if (this._styleSheet === void 0) {
            if (supportsAdoptingStyleSheets) {
                this._styleSheet = new CSSStyleSheet();
                this._styleSheet.replaceSync(this.cssText);
            } else {
                this._styleSheet = null;
            }
        }
        return this._styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
const unsafeCSS = (value)=>{
    return new CSSResult(String(value), constructionToken);
};
const textFromCSSResult = (value)=>{
    if (value instanceof CSSResult) {
        return value.cssText;
    } else if (typeof value === "number") {
        return value;
    } else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ${value}. Use 'unsafeCSS' to pass non-literal values, but
            take care to ensure page security.`);
    }
};
const css = (strings, ...values)=>{
    const cssText = values.reduce((acc, v, idx)=>acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, constructionToken);
};
(window["litElementVersions"] || (window["litElementVersions"] = [])).push("2.5.1");
const renderNotImplemented = {};
class LitElement extends UpdatingElement {
    static getStyles() {
        return this.styles;
    }
    static _getUniqueStyles() {
        if (this.hasOwnProperty(JSCompiler_renameProperty("_styles", this))) {
            return;
        }
        const userStyles = this.getStyles();
        if (Array.isArray(userStyles)) {
            const addStyles = (styles2, set2)=>styles2.reduceRight((set3, s)=>Array.isArray(s) ? addStyles(s, set3) : (set3.add(s), set3), set2);
            const set = addStyles(userStyles, new Set());
            const styles = [];
            set.forEach((v)=>styles.unshift(v));
            this._styles = styles;
        } else {
            this._styles = userStyles === void 0 ? [] : [
                userStyles
            ];
        }
        this._styles = this._styles.map((s)=>{
            if (s instanceof CSSStyleSheet && !supportsAdoptingStyleSheets) {
                const cssText = Array.prototype.slice.call(s.cssRules).reduce((css2, rule)=>css2 + rule.cssText, "");
                return unsafeCSS(cssText);
            }
            return s;
        });
    }
    initialize() {
        super.initialize();
        this.constructor._getUniqueStyles();
        this.renderRoot = this.createRenderRoot();
        if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
            this.adoptStyles();
        }
    }
    createRenderRoot() {
        return this.attachShadow(this.constructor.shadowRootOptions);
    }
    adoptStyles() {
        const styles = this.constructor._styles;
        if (styles.length === 0) {
            return;
        }
        if (window.ShadyCSS !== void 0 && !window.ShadyCSS.nativeShadow) {
            window.ShadyCSS.ScopingShim.prepareAdoptedCssText(styles.map((s)=>s.cssText), this.localName);
        } else if (supportsAdoptingStyleSheets) {
            this.renderRoot.adoptedStyleSheets = styles.map((s)=>s instanceof CSSStyleSheet ? s : s.styleSheet);
        } else {
            this._needsShimAdoptedStyleSheets = true;
        }
    }
    connectedCallback() {
        super.connectedCallback();
        if (this.hasUpdated && window.ShadyCSS !== void 0) {
            window.ShadyCSS.styleElement(this);
        }
    }
    update(changedProperties) {
        const templateResult = this.render();
        super.update(changedProperties);
        if (templateResult !== renderNotImplemented) {
            this.constructor.render(templateResult, this.renderRoot, {
                scopeName: this.localName,
                eventContext: this
            });
        }
        if (this._needsShimAdoptedStyleSheets) {
            this._needsShimAdoptedStyleSheets = false;
            this.constructor._styles.forEach((s)=>{
                const style = document.createElement("style");
                style.textContent = s.cssText;
                this.renderRoot.appendChild(style);
            });
        }
    }
    render() {
        return renderNotImplemented;
    }
}
LitElement["finalized"] = true;
LitElement.render = render;
LitElement.shadowRootOptions = {
    mode: "open"
};
class Theme {
    static primaryColor200Hex = '#69b7ff';
    static primaryColor300Hex = '#0088FF';
    static primaryColor900Hex = '#005ccb';
    static backgroundColorHex = '#121212';
    static textColorHex = '#ebebeb';
    static textColorSecondaryHex = '#888888';
    static sansSerifFontFamily = '-apple-system, BlinkMacSystemFont, avenir next, avenir, helvetica neue, helvetica, Ubuntu, roboto, noto, segoe ui, arial, sans-serif';
    static monospaceFontFamily = 'Menlo, "SF Mono", "Andale Mono", "Roboto Mono", Monaco, monospace';
    static textColorErrorHex = '#b71c1c';
}
const PODCAST_INDEX_NAMESPACE = 'https://podcastindex.org/namespace/1.0';
const PODCAST_INDEX_NAMESPACE_ALT = 'https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md';
const PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING = 'https://podcastindex.org/namespace/1.0/';
const PODCAST_INDEX_NAMESPACES = [
    PODCAST_INDEX_NAMESPACE,
    PODCAST_INDEX_NAMESPACE_ALT,
    PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING
];
const PODCAST_INDEX_KNOWN_NAMES = new Set();
function _podcastIndex(name, known = true) {
    if (known) PODCAST_INDEX_KNOWN_NAMES.add(name);
    return PODCAST_INDEX_NAMESPACES.map((v)=>({
            name,
            namespaceUri: v
        }));
}
const MEDIA_RSS_NAMESPACE = 'http://search.yahoo.com/mrss/';
function _mediaRss(name) {
    return {
        name,
        namespaceUri: MEDIA_RSS_NAMESPACE
    };
}
const ITUNES_NAMESPACE = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
function _itunes(name) {
    return {
        name,
        namespaceUri: ITUNES_NAMESPACE
    };
}
class Qnames {
    static PodcastIndex = {
        NAMESPACES: PODCAST_INDEX_NAMESPACES,
        KNOWN_MISSPELLED_NAMESPACES: [
            PODCAST_INDEX_NAMESPACE_KNOWN_MISSPELLING
        ],
        get KNOWN_NAMES () {
            return PODCAST_INDEX_KNOWN_NAMES;
        },
        of: (name)=>_podcastIndex(name, false),
        alternateEnclosure: _podcastIndex('alternateEnclosure'),
        block: _podcastIndex('block'),
        chapters: _podcastIndex('chapters'),
        chat: _podcastIndex('chat'),
        complete: _podcastIndex('complete'),
        contentLink: _podcastIndex('contentLink'),
        episode: _podcastIndex('episode'),
        funding: _podcastIndex('funding'),
        guid: _podcastIndex('guid'),
        hiveAccount: _podcastIndex('hiveAccount'),
        images: _podcastIndex('images'),
        image: _podcastIndex('image'),
        integrity: _podcastIndex('integrity'),
        license: _podcastIndex('license'),
        liveItem: _podcastIndex('liveItem'),
        location: _podcastIndex('location'),
        locked: _podcastIndex('locked'),
        medium: _podcastIndex('medium'),
        person: _podcastIndex('person'),
        podping: _podcastIndex('podping'),
        podroll: _podcastIndex('podroll'),
        publisher: _podcastIndex('publisher'),
        remoteItem: _podcastIndex('remoteItem'),
        season: _podcastIndex('season'),
        social: _podcastIndex('social'),
        socialInteract: _podcastIndex('socialInteract'),
        socialSignUp: _podcastIndex('socialSignUp'),
        soundbite: _podcastIndex('soundbite'),
        source: _podcastIndex('source'),
        trailer: _podcastIndex('trailer'),
        transcript: _podcastIndex('transcript'),
        txt: _podcastIndex('txt'),
        updateFrequency: _podcastIndex('updateFrequency'),
        value: _podcastIndex('value'),
        valueRecipient: _podcastIndex('valueRecipient'),
        valueTimeSplit: _podcastIndex('valueTimeSplit')
    };
    static MediaRss = {
        NAMESPACE: MEDIA_RSS_NAMESPACE,
        of: (name)=>_mediaRss(name),
        content: _mediaRss('content')
    };
    static Itunes = {
        NAMESPACE: ITUNES_NAMESPACE,
        of: (name)=>_itunes(name),
        duration: _itunes('duration'),
        type: _itunes('type')
    };
}
function checkEqual(name, value, expected) {
    if (value !== expected) throw new Error(`Bad ${name}: expected ${expected}, found ${value}`);
}
const hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
const numRegex = /^([\-\+])?(0*)(\.[0-9]+([eE]\-?[0-9]+)?|[0-9]+(\.[0-9]+([eE]\-?[0-9]+)?)?)$/;
if (!Number.parseInt && window.parseInt) {
    Number.parseInt = window.parseInt;
}
if (!Number.parseFloat && window.parseFloat) {
    Number.parseFloat = window.parseFloat;
}
const consider = {
    hex: true,
    leadingZeros: true,
    decimalPoint: ".",
    eNotation: true
};
function toNumber(str, options = {}) {
    options = Object.assign({}, consider, options);
    if (!str || typeof str !== "string") return str;
    let trimmedStr = str.trim();
    if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
    else if (options.hex && hexRegex.test(trimmedStr)) {
        return Number.parseInt(trimmedStr, 16);
    } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
            const sign = match[1];
            const leadingZeros = match[2];
            let numTrimmedByZeros = trimZeros(match[3]);
            const eNotation = match[4] || match[6];
            if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str;
            else if (!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str;
            else {
                const num = Number(trimmedStr);
                const numStr = "" + num;
                if (numStr.search(/[eE]/) !== -1) {
                    if (options.eNotation) return num;
                    else return str;
                } else if (eNotation) {
                    if (options.eNotation) return num;
                    else return str;
                } else if (trimmedStr.indexOf(".") !== -1) {
                    if (numStr === "0" && numTrimmedByZeros === "") return num;
                    else if (numStr === numTrimmedByZeros) return num;
                    else if (sign && numStr === "-" + numTrimmedByZeros) return num;
                    else return str;
                }
                if (leadingZeros) {
                    if (numTrimmedByZeros === numStr) return num;
                    else if (sign + numTrimmedByZeros === numStr) return num;
                    else return str;
                }
                if (trimmedStr === numStr) return num;
                else if (trimmedStr === sign + numStr) return num;
                return str;
            }
        } else {
            return str;
        }
    }
}
function trimZeros(numStr) {
    if (numStr && numStr.indexOf(".") !== -1) {
        numStr = numStr.replace(/0+$/, "");
        if (numStr === ".") numStr = "0";
        else if (numStr[0] === ".") numStr = "0" + numStr;
        else if (numStr[numStr.length - 1] === ".") numStr = numStr.substr(0, numStr.length - 1);
        return numStr;
    }
    return numStr;
}
var strnum = toNumber;
function createCommonjsModule(fn, basedir, module) {
    return module = {
        path: basedir,
        exports: {},
        require: function(path, base) {
            return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
        }
    }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
    throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
var util = createCommonjsModule(function(module, exports) {
    const nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
    const nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
    const nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
    const regexName = new RegExp("^" + nameRegexp + "$");
    const getAllMatches = function(string, regex) {
        const matches = [];
        let match = regex.exec(string);
        while(match){
            const allmatches = [];
            allmatches.startIndex = regex.lastIndex - match[0].length;
            const len = match.length;
            for(let index = 0; index < len; index++){
                allmatches.push(match[index]);
            }
            matches.push(allmatches);
            match = regex.exec(string);
        }
        return matches;
    };
    const isName = function(string) {
        const match = regexName.exec(string);
        return !(match === null || typeof match === "undefined");
    };
    exports.isExist = function(v) {
        return typeof v !== "undefined";
    };
    exports.isEmptyObject = function(obj) {
        return Object.keys(obj).length === 0;
    };
    exports.merge = function(target, a, arrayMode) {
        if (a) {
            const keys = Object.keys(a);
            const len = keys.length;
            for(let i = 0; i < len; i++){
                if (arrayMode === "strict") {
                    target[keys[i]] = [
                        a[keys[i]]
                    ];
                } else {
                    target[keys[i]] = a[keys[i]];
                }
            }
        }
    };
    exports.getValue = function(v) {
        if (exports.isExist(v)) {
            return v;
        } else {
            return "";
        }
    };
    exports.buildOptions = function(options, defaultOptions2, props2) {
        let newOptions = {};
        if (!options) {
            return defaultOptions2;
        }
        for(let i = 0; i < props2.length; i++){
            if (options[props2[i]] !== void 0) {
                newOptions[props2[i]] = options[props2[i]];
            } else {
                newOptions[props2[i]] = defaultOptions2[props2[i]];
            }
        }
        return newOptions;
    };
    exports.isTagNameInArrayMode = function(tagName, arrayMode, parentTagName) {
        if (arrayMode === false) {
            return false;
        } else if (arrayMode instanceof RegExp) {
            return arrayMode.test(tagName);
        } else if (typeof arrayMode === "function") {
            return !!arrayMode(tagName, parentTagName);
        }
        return arrayMode === "strict";
    };
    exports.isName = isName;
    exports.getAllMatches = getAllMatches;
    exports.nameRegexp = nameRegexp;
});
const convertToJson = function(node, options, parentTagName) {
    const jObj = {};
    if (!options.alwaysCreateTextNode && (!node.child || util.isEmptyObject(node.child)) && (!node.attrsMap || util.isEmptyObject(node.attrsMap))) {
        return util.isExist(node.val) ? node.val : "";
    }
    if (util.isExist(node.val) && !(typeof node.val === "string" && (node.val === "" || node.val === options.cdataPositionChar))) {
        const asArray = util.isTagNameInArrayMode(node.tagname, options.arrayMode, parentTagName);
        jObj[options.textNodeName] = asArray ? [
            node.val
        ] : node.val;
    }
    util.merge(jObj, node.attrsMap, options.arrayMode);
    const keys = Object.keys(node.child);
    for(let index = 0; index < keys.length; index++){
        const tagName = keys[index];
        if (node.child[tagName] && node.child[tagName].length > 1) {
            jObj[tagName] = [];
            for(let tag in node.child[tagName]){
                if (node.child[tagName].hasOwnProperty(tag)) {
                    jObj[tagName].push(convertToJson(node.child[tagName][tag], options, tagName));
                }
            }
        } else {
            const result = convertToJson(node.child[tagName][0], options, tagName);
            const asArray = options.arrayMode === true && typeof result === "object" || util.isTagNameInArrayMode(tagName, options.arrayMode, parentTagName);
            jObj[tagName] = asArray ? [
                result
            ] : result;
        }
    }
    return jObj;
};
var convertToJson_1 = convertToJson;
var node2json = {
    convertToJson: convertToJson_1
};
var xmlNode = function(tagname, parent, val) {
    this.tagname = tagname;
    this.parent = parent;
    this.child = {};
    this.attrsMap = {};
    this.val = val;
    this.addChild = function(child) {
        if (Array.isArray(this.child[child.tagname])) {
            this.child[child.tagname].push(child);
        } else {
            this.child[child.tagname] = [
                child
            ];
        }
    };
};
const buildOptions = util.buildOptions;
"<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|((NAME:)?(NAME))([^>]*)>|((\\/)(NAME)\\s*>))([^<]*)".replace(/NAME/g, util.nameRegexp);
if (!Number.parseInt && window.parseInt) {
    Number.parseInt = window.parseInt;
}
if (!Number.parseFloat && window.parseFloat) {
    Number.parseFloat = window.parseFloat;
}
const defaultOptions = {
    attributeNamePrefix: "@_",
    attrNodeName: false,
    textNodeName: "#text",
    ignoreAttributes: true,
    ignoreNameSpace: false,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    arrayMode: false,
    trimValues: true,
    cdataTagName: false,
    cdataPositionChar: "\\c",
    numParseOptions: {
        hex: true,
        leadingZeros: true
    },
    tagValueProcessor: function(a, tagName) {
        return a;
    },
    attrValueProcessor: function(a, attrName) {
        return a;
    },
    stopNodes: [],
    alwaysCreateTextNode: false
};
var defaultOptions_1 = defaultOptions;
const props = [
    "attributeNamePrefix",
    "attrNodeName",
    "textNodeName",
    "ignoreAttributes",
    "ignoreNameSpace",
    "allowBooleanAttributes",
    "parseNodeValue",
    "parseAttributeValue",
    "arrayMode",
    "trimValues",
    "cdataTagName",
    "cdataPositionChar",
    "tagValueProcessor",
    "attrValueProcessor",
    "parseTrueNumberOnly",
    "numParseOptions",
    "stopNodes",
    "alwaysCreateTextNode"
];
var props_1 = props;
function processTagValue(tagName, val, options) {
    if (val) {
        if (options.trimValues) {
            val = val.trim();
        }
        val = options.tagValueProcessor(val, tagName);
        val = parseValue(val, options.parseNodeValue, options.numParseOptions);
    }
    return val;
}
function resolveNameSpace(tagname, options) {
    if (options.ignoreNameSpace) {
        const tags = tagname.split(":");
        const prefix = tagname.charAt(0) === "/" ? "/" : "";
        if (tags[0] === "xmlns") {
            return "";
        }
        if (tags.length === 2) {
            tagname = prefix + tags[1];
        }
    }
    return tagname;
}
function parseValue(val, shouldParse, options) {
    if (shouldParse && typeof val === "string") {
        const newval = val.trim();
        if (newval === "true") return true;
        else if (newval === "false") return false;
        else return strnum(val, options);
    } else {
        if (util.isExist(val)) {
            return val;
        } else {
            return "";
        }
    }
}
const attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])(.*?)\\3)?`, "g");
function buildAttributesMap(attrStr, options) {
    if (!options.ignoreAttributes && typeof attrStr === "string") {
        attrStr = attrStr.replace(/\r?\n/g, " ");
        const matches = util.getAllMatches(attrStr, attrsRegx);
        const len = matches.length;
        const attrs = {};
        for(let i = 0; i < len; i++){
            const attrName = resolveNameSpace(matches[i][1], options);
            if (attrName.length) {
                if (matches[i][4] !== void 0) {
                    if (options.trimValues) {
                        matches[i][4] = matches[i][4].trim();
                    }
                    matches[i][4] = options.attrValueProcessor(matches[i][4], attrName);
                    attrs[options.attributeNamePrefix + attrName] = parseValue(matches[i][4], options.parseAttributeValue, options.numParseOptions);
                } else if (options.allowBooleanAttributes) {
                    attrs[options.attributeNamePrefix + attrName] = true;
                }
            }
        }
        if (!Object.keys(attrs).length) {
            return;
        }
        if (options.attrNodeName) {
            const attrCollection = {};
            attrCollection[options.attrNodeName] = attrs;
            return attrCollection;
        }
        return attrs;
    }
}
const getTraversalObj = function(xmlData, options) {
    xmlData = xmlData.replace(/\r\n?/g, "\n");
    options = buildOptions(options, defaultOptions, props);
    const xmlObj = new xmlNode("!xml");
    let currentNode = xmlObj;
    let textData = "";
    for(let i = 0; i < xmlData.length; i++){
        const ch = xmlData[i];
        if (ch === "<") {
            if (xmlData[i + 1] === "/") {
                const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
                let tagName = xmlData.substring(i + 2, closeIndex).trim();
                if (options.ignoreNameSpace) {
                    const colonIndex = tagName.indexOf(":");
                    if (colonIndex !== -1) {
                        tagName = tagName.substr(colonIndex + 1);
                    }
                }
                if (currentNode) {
                    if (currentNode.val) {
                        currentNode.val = util.getValue(currentNode.val) + "" + processTagValue(tagName, textData, options);
                    } else {
                        currentNode.val = processTagValue(tagName, textData, options);
                    }
                }
                if (options.stopNodes.length && options.stopNodes.includes(currentNode.tagname)) {
                    currentNode.child = [];
                    if (currentNode.attrsMap == void 0) {
                        currentNode.attrsMap = {};
                    }
                    currentNode.val = xmlData.substr(currentNode.startIndex + 1, i - currentNode.startIndex - 1);
                }
                currentNode = currentNode.parent;
                textData = "";
                i = closeIndex;
            } else if (xmlData[i + 1] === "?") {
                i = findClosingIndex(xmlData, "?>", i, "Pi Tag is not closed.");
            } else if (xmlData.substr(i + 1, 3) === "!--") {
                i = findClosingIndex(xmlData, "-->", i, "Comment is not closed.");
            } else if (xmlData.substr(i + 1, 2) === "!D") {
                const closeIndex = findClosingIndex(xmlData, ">", i, "DOCTYPE is not closed.");
                const tagExp = xmlData.substring(i, closeIndex);
                if (tagExp.indexOf("[") >= 0) {
                    i = xmlData.indexOf("]>", i) + 1;
                } else {
                    i = closeIndex;
                }
            } else if (xmlData.substr(i + 1, 2) === "![") {
                const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
                const tagExp = xmlData.substring(i + 9, closeIndex);
                if (textData) {
                    currentNode.val = util.getValue(currentNode.val) + "" + processTagValue(currentNode.tagname, textData, options);
                    textData = "";
                }
                if (options.cdataTagName) {
                    const childNode = new xmlNode(options.cdataTagName, currentNode, tagExp);
                    currentNode.addChild(childNode);
                    currentNode.val = util.getValue(currentNode.val) + options.cdataPositionChar;
                    if (tagExp) {
                        childNode.val = tagExp;
                    }
                } else {
                    currentNode.val = (currentNode.val || "") + (tagExp || "");
                }
                i = closeIndex + 2;
            } else {
                const result = closingIndexForOpeningTag(xmlData, i + 1);
                let tagExp = result.data;
                const closeIndex = result.index;
                const separatorIndex = tagExp.indexOf(" ");
                let tagName = tagExp;
                let shouldBuildAttributesMap = true;
                if (separatorIndex !== -1) {
                    tagName = tagExp.substr(0, separatorIndex).replace(/\s\s*$/, "");
                    tagExp = tagExp.substr(separatorIndex + 1);
                }
                if (options.ignoreNameSpace) {
                    const colonIndex = tagName.indexOf(":");
                    if (colonIndex !== -1) {
                        tagName = tagName.substr(colonIndex + 1);
                        shouldBuildAttributesMap = tagName !== result.data.substr(colonIndex + 1);
                    }
                }
                if (currentNode && textData) {
                    if (currentNode.tagname !== "!xml") {
                        currentNode.val = util.getValue(currentNode.val) + "" + processTagValue(currentNode.tagname, textData, options);
                    }
                }
                if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                    if (tagName[tagName.length - 1] === "/") {
                        tagName = tagName.substr(0, tagName.length - 1);
                        tagExp = tagName;
                    } else {
                        tagExp = tagExp.substr(0, tagExp.length - 1);
                    }
                    const childNode = new xmlNode(tagName, currentNode, "");
                    if (tagName !== tagExp) {
                        childNode.attrsMap = buildAttributesMap(tagExp, options);
                    }
                    currentNode.addChild(childNode);
                } else {
                    const childNode = new xmlNode(tagName, currentNode);
                    if (options.stopNodes.length && options.stopNodes.includes(childNode.tagname)) {
                        childNode.startIndex = closeIndex;
                    }
                    if (tagName !== tagExp && shouldBuildAttributesMap) {
                        childNode.attrsMap = buildAttributesMap(tagExp, options);
                    }
                    currentNode.addChild(childNode);
                    currentNode = childNode;
                }
                textData = "";
                i = closeIndex;
            }
        } else {
            textData += xmlData[i];
        }
    }
    return xmlObj;
};
function closingIndexForOpeningTag(data, i) {
    let attrBoundary;
    let tagExp = "";
    for(let index = i; index < data.length; index++){
        let ch = data[index];
        if (attrBoundary) {
            if (ch === attrBoundary) attrBoundary = "";
        } else if (ch === '"' || ch === "'") {
            attrBoundary = ch;
        } else if (ch === ">") {
            return {
                data: tagExp,
                index
            };
        } else if (ch === "	") {
            ch = " ";
        }
        tagExp += ch;
    }
}
function findClosingIndex(xmlData, str, i, errMsg) {
    const closingIndex = xmlData.indexOf(str, i);
    if (closingIndex === -1) {
        throw new Error(errMsg);
    } else {
        return closingIndex + str.length - 1;
    }
}
var getTraversalObj_1 = getTraversalObj;
var xmlstr2xmlnode = {
    defaultOptions: defaultOptions_1,
    props: props_1,
    getTraversalObj: getTraversalObj_1
};
const defaultOptions$1 = {
    allowBooleanAttributes: false
};
const props$1 = [
    "allowBooleanAttributes"
];
var validate = function(xmlData, options) {
    options = util.buildOptions(options, defaultOptions$1, props$1);
    const tags = [];
    let tagFound = false;
    let reachedRoot = false;
    if (xmlData[0] === "\uFEFF") {
        xmlData = xmlData.substr(1);
    }
    for(let i = 0; i < xmlData.length; i++){
        if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
            i += 2;
            i = readPI(xmlData, i);
            if (i.err) return i;
        } else if (xmlData[i] === "<") {
            let tagStartPos = i;
            i++;
            if (xmlData[i] === "!") {
                i = readCommentAndCDATA(xmlData, i);
                continue;
            } else {
                let closingTag = false;
                if (xmlData[i] === "/") {
                    closingTag = true;
                    i++;
                }
                let tagName = "";
                for(; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++){
                    tagName += xmlData[i];
                }
                tagName = tagName.trim();
                if (tagName[tagName.length - 1] === "/") {
                    tagName = tagName.substring(0, tagName.length - 1);
                    i--;
                }
                if (!validateTagName(tagName)) {
                    let msg;
                    if (tagName.trim().length === 0) {
                        msg = "Invalid space after '<'.";
                    } else {
                        msg = "Tag '" + tagName + "' is an invalid name.";
                    }
                    return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
                }
                const result = readAttributeStr(xmlData, i);
                if (result === false) {
                    return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
                }
                let attrStr = result.value;
                i = result.index;
                if (attrStr[attrStr.length - 1] === "/") {
                    const attrStrStart = i - attrStr.length;
                    attrStr = attrStr.substring(0, attrStr.length - 1);
                    const isValid = validateAttributeString(attrStr, options);
                    if (isValid === true) {
                        tagFound = true;
                    } else {
                        return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
                    }
                } else if (closingTag) {
                    if (!result.tagClosed) {
                        return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
                    } else if (attrStr.trim().length > 0) {
                        return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
                    } else {
                        const otg = tags.pop();
                        if (tagName !== otg.tagName) {
                            let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                            return getErrorObject("InvalidTag", "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.", getLineNumberForPosition(xmlData, tagStartPos));
                        }
                        if (tags.length == 0) {
                            reachedRoot = true;
                        }
                    }
                } else {
                    const isValid = validateAttributeString(attrStr, options);
                    if (isValid !== true) {
                        return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
                    }
                    if (reachedRoot === true) {
                        return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
                    } else {
                        tags.push({
                            tagName,
                            tagStartPos
                        });
                    }
                    tagFound = true;
                }
                for(i++; i < xmlData.length; i++){
                    if (xmlData[i] === "<") {
                        if (xmlData[i + 1] === "!") {
                            i++;
                            i = readCommentAndCDATA(xmlData, i);
                            continue;
                        } else if (xmlData[i + 1] === "?") {
                            i = readPI(xmlData, ++i);
                            if (i.err) return i;
                        } else {
                            break;
                        }
                    } else if (xmlData[i] === "&") {
                        const afterAmp = validateAmpersand(xmlData, i);
                        if (afterAmp == -1) return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
                        i = afterAmp;
                    }
                }
                if (xmlData[i] === "<") {
                    i--;
                }
            }
        } else {
            if (xmlData[i] === " " || xmlData[i] === "	" || xmlData[i] === "\n" || xmlData[i] === "\r") {
                continue;
            }
            return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
        }
    }
    if (!tagFound) {
        return getErrorObject("InvalidXml", "Start tag expected.", 1);
    } else if (tags.length == 1) {
        return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
    } else if (tags.length > 0) {
        return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t)=>t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", {
            line: 1,
            col: 1
        });
    }
    return true;
};
function readPI(xmlData, i) {
    const start = i;
    for(; i < xmlData.length; i++){
        if (xmlData[i] == "?" || xmlData[i] == " ") {
            const tagname = xmlData.substr(start, i - start);
            if (i > 5 && tagname === "xml") {
                return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
            } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
                i++;
                break;
            } else {
                continue;
            }
        }
    }
    return i;
}
function readCommentAndCDATA(xmlData, i) {
    if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
        for(i += 3; i < xmlData.length; i++){
            if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
                i += 2;
                break;
            }
        }
    } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
        let angleBracketsCount = 1;
        for(i += 8; i < xmlData.length; i++){
            if (xmlData[i] === "<") {
                angleBracketsCount++;
            } else if (xmlData[i] === ">") {
                angleBracketsCount--;
                if (angleBracketsCount === 0) {
                    break;
                }
            }
        }
    } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
        for(i += 8; i < xmlData.length; i++){
            if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
                i += 2;
                break;
            }
        }
    }
    return i;
}
const doubleQuote = '"';
const singleQuote = "'";
function readAttributeStr(xmlData, i) {
    let attrStr = "";
    let startChar = "";
    let tagClosed = false;
    for(; i < xmlData.length; i++){
        if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
            if (startChar === "") {
                startChar = xmlData[i];
            } else if (startChar !== xmlData[i]) ;
            else {
                startChar = "";
            }
        } else if (xmlData[i] === ">") {
            if (startChar === "") {
                tagClosed = true;
                break;
            }
        }
        attrStr += xmlData[i];
    }
    if (startChar !== "") {
        return false;
    }
    return {
        value: attrStr,
        index: i,
        tagClosed
    };
}
const validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
function validateAttributeString(attrStr, options) {
    const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
    const attrNames = {};
    for(let i = 0; i < matches.length; i++){
        if (matches[i][1].length === 0) {
            return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
            return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
        }
        const attrName = matches[i][2];
        if (!validateAttrName(attrName)) {
            return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
        }
        if (!attrNames.hasOwnProperty(attrName)) {
            attrNames[attrName] = 1;
        } else {
            return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
        }
    }
    return true;
}
function validateNumberAmpersand(xmlData, i) {
    let re = /\d/;
    if (xmlData[i] === "x") {
        i++;
        re = /[\da-fA-F]/;
    }
    for(; i < xmlData.length; i++){
        if (xmlData[i] === ";") return i;
        if (!xmlData[i].match(re)) break;
    }
    return -1;
}
function validateAmpersand(xmlData, i) {
    i++;
    if (xmlData[i] === ";") return -1;
    if (xmlData[i] === "#") {
        i++;
        return validateNumberAmpersand(xmlData, i);
    }
    let count = 0;
    for(; i < xmlData.length; i++, count++){
        if (xmlData[i].match(/\w/) && count < 20) continue;
        if (xmlData[i] === ";") break;
        return -1;
    }
    return i;
}
function getErrorObject(code, message, lineNumber) {
    return {
        err: {
            code,
            msg: message,
            line: lineNumber.line || lineNumber,
            col: lineNumber.col
        }
    };
}
function validateAttrName(attrName) {
    return util.isName(attrName);
}
function validateTagName(tagname) {
    return util.isName(tagname);
}
function getLineNumberForPosition(xmlData, index) {
    const lines = xmlData.substring(0, index).split(/\r?\n/);
    return {
        line: lines.length,
        col: lines[lines.length - 1].length + 1
    };
}
function getPositionFromMatch(match) {
    return match.startIndex + match[1].length;
}
var validator = {
    validate
};
const __char = function(a) {
    return String.fromCharCode(a);
};
const chars = {
    nilChar: __char(176),
    missingChar: __char(201),
    nilPremitive: __char(175),
    missingPremitive: __char(200),
    emptyChar: __char(178),
    emptyValue: __char(177),
    boundryChar: __char(179),
    objStart: __char(198),
    arrStart: __char(204),
    arrayEnd: __char(185)
};
const charsArr = [
    chars.nilChar,
    chars.nilPremitive,
    chars.missingChar,
    chars.missingPremitive,
    chars.boundryChar,
    chars.emptyChar,
    chars.emptyValue,
    chars.arrayEnd,
    chars.objStart,
    chars.arrStart
];
const _e = function(node, e_schema, options) {
    if (typeof e_schema === "string") {
        if (node && node[0] && node[0].val !== void 0) {
            return getValue(node[0].val);
        } else {
            return getValue(node);
        }
    } else {
        const hasValidData = hasData(node);
        if (hasValidData === true) {
            let str = "";
            if (Array.isArray(e_schema)) {
                str += chars.arrStart;
                const itemSchema = e_schema[0];
                const arr_len = node.length;
                if (typeof itemSchema === "string") {
                    for(let arr_i = 0; arr_i < arr_len; arr_i++){
                        const r = getValue(node[arr_i].val);
                        str = processValue(str, r);
                    }
                } else {
                    for(let arr_i = 0; arr_i < arr_len; arr_i++){
                        const r = _e(node[arr_i], itemSchema, options);
                        str = processValue(str, r);
                    }
                }
                str += chars.arrayEnd;
            } else {
                str += chars.objStart;
                const keys = Object.keys(e_schema);
                if (Array.isArray(node)) {
                    node = node[0];
                }
                for(let i in keys){
                    const key = keys[i];
                    let r;
                    if (!options.ignoreAttributes && node.attrsMap && node.attrsMap[key]) {
                        r = _e(node.attrsMap[key], e_schema[key], options);
                    } else if (key === options.textNodeName) {
                        r = _e(node.val, e_schema[key], options);
                    } else {
                        r = _e(node.child[key], e_schema[key], options);
                    }
                    str = processValue(str, r);
                }
            }
            return str;
        } else {
            return hasValidData;
        }
    }
};
const getValue = function(a) {
    switch(a){
        case void 0:
            return chars.missingPremitive;
        case null:
            return chars.nilPremitive;
        case "":
            return chars.emptyValue;
        default:
            return a;
    }
};
const processValue = function(str, r) {
    if (!isAppChar(r[0]) && !isAppChar(str[str.length - 1])) {
        str += chars.boundryChar;
    }
    return str + r;
};
const isAppChar = function(ch) {
    return charsArr.indexOf(ch) !== -1;
};
function hasData(jObj) {
    if (jObj === void 0) {
        return chars.missingChar;
    } else if (jObj === null) {
        return chars.nilChar;
    } else if (jObj.child && Object.keys(jObj.child).length === 0 && (!jObj.attrsMap || Object.keys(jObj.attrsMap).length === 0)) {
        return chars.emptyChar;
    } else {
        return true;
    }
}
const buildOptions$1 = util.buildOptions;
const convert2nimn = function(node, e_schema, options) {
    options = buildOptions$1(options, xmlstr2xmlnode.defaultOptions, xmlstr2xmlnode.props);
    return _e(node, e_schema, options);
};
var convert2nimn_1 = convert2nimn;
var nimndata = {
    convert2nimn: convert2nimn_1
};
const buildOptions$2 = util.buildOptions;
const convertToJsonString = function(node, options) {
    options = buildOptions$2(options, xmlstr2xmlnode.defaultOptions, xmlstr2xmlnode.props);
    options.indentBy = options.indentBy || "";
    return _cToJsonStr(node, options);
};
const _cToJsonStr = function(node, options, level) {
    let jObj = "{";
    const keys = Object.keys(node.child);
    for(let index = 0; index < keys.length; index++){
        const tagname = keys[index];
        if (node.child[tagname] && node.child[tagname].length > 1) {
            jObj += '"' + tagname + '" : [ ';
            for(let tag in node.child[tagname]){
                jObj += _cToJsonStr(node.child[tagname][tag], options) + " , ";
            }
            jObj = jObj.substr(0, jObj.length - 1) + " ] ";
        } else {
            jObj += '"' + tagname + '" : ' + _cToJsonStr(node.child[tagname][0], options) + " ,";
        }
    }
    util.merge(jObj, node.attrsMap);
    if (util.isEmptyObject(jObj)) {
        return util.isExist(node.val) ? node.val : "";
    } else {
        if (util.isExist(node.val)) {
            if (!(typeof node.val === "string" && (node.val === "" || node.val === options.cdataPositionChar))) {
                jObj += '"' + options.textNodeName + '" : ' + stringval(node.val);
            }
        }
    }
    if (jObj[jObj.length - 1] === ",") {
        jObj = jObj.substr(0, jObj.length - 2);
    }
    return jObj + "}";
};
function stringval(v) {
    if (v === true || v === false || !isNaN(v)) {
        return v;
    } else {
        return '"' + v + '"';
    }
}
var convertToJsonString_1 = convertToJsonString;
var node2json_str = {
    convertToJsonString: convertToJsonString_1
};
const buildOptions$3 = util.buildOptions;
const defaultOptions$2 = {
    attributeNamePrefix: "@_",
    attrNodeName: false,
    textNodeName: "#text",
    ignoreAttributes: true,
    cdataTagName: false,
    cdataPositionChar: "\\c",
    format: false,
    indentBy: "  ",
    supressEmptyNode: false,
    tagValueProcessor: function(a) {
        return a;
    },
    attrValueProcessor: function(a) {
        return a;
    }
};
const props$2 = [
    "attributeNamePrefix",
    "attrNodeName",
    "textNodeName",
    "ignoreAttributes",
    "cdataTagName",
    "cdataPositionChar",
    "format",
    "indentBy",
    "supressEmptyNode",
    "tagValueProcessor",
    "attrValueProcessor",
    "rootNodeName"
];
function Parser(options) {
    this.options = buildOptions$3(options, defaultOptions$2, props$2);
    if (this.options.ignoreAttributes || this.options.attrNodeName) {
        this.isAttribute = function() {
            return false;
        };
    } else {
        this.attrPrefixLen = this.options.attributeNamePrefix.length;
        this.isAttribute = isAttribute;
    }
    if (this.options.cdataTagName) {
        this.isCDATA = isCDATA;
    } else {
        this.isCDATA = function() {
            return false;
        };
    }
    this.replaceCDATAstr = replaceCDATAstr;
    this.replaceCDATAarr = replaceCDATAarr;
    this.processTextOrObjNode = processTextOrObjNode;
    if (this.options.format) {
        this.indentate = indentate;
        this.tagEndChar = ">\n";
        this.newLine = "\n";
    } else {
        this.indentate = function() {
            return "";
        };
        this.tagEndChar = ">";
        this.newLine = "";
    }
    if (this.options.supressEmptyNode) {
        this.buildTextNode = buildEmptyTextNode;
        this.buildObjNode = buildEmptyObjNode;
    } else {
        this.buildTextNode = buildTextValNode;
        this.buildObjNode = buildObjectNode;
    }
    this.buildTextValNode = buildTextValNode;
    this.buildObjectNode = buildObjectNode;
}
Parser.prototype.parse = function(jObj) {
    if (Array.isArray(jObj) && this.options.rootNodeName && this.options.rootNodeName.length > 1) {
        jObj = {
            [this.options.rootNodeName]: jObj
        };
    }
    return this.j2x(jObj, 0).val;
};
Parser.prototype.j2x = function(jObj, level) {
    let attrStr = "";
    let val = "";
    for(let key in jObj){
        if (typeof jObj[key] === "undefined") ;
        else if (jObj[key] === null) {
            val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
        } else if (jObj[key] instanceof Date) {
            val += this.buildTextNode(jObj[key], key, "", level);
        } else if (typeof jObj[key] !== "object") {
            const attr = this.isAttribute(key);
            if (attr) {
                attrStr += " " + attr + '="' + this.options.attrValueProcessor("" + jObj[key]) + '"';
            } else if (this.isCDATA(key)) {
                if (jObj[this.options.textNodeName]) {
                    val += this.replaceCDATAstr(jObj[this.options.textNodeName], jObj[key]);
                } else {
                    val += this.replaceCDATAstr("", jObj[key]);
                }
            } else {
                if (key === this.options.textNodeName) {
                    if (jObj[this.options.cdataTagName]) ;
                    else {
                        val += this.options.tagValueProcessor("" + jObj[key]);
                    }
                } else {
                    val += this.buildTextNode(jObj[key], key, "", level);
                }
            }
        } else if (Array.isArray(jObj[key])) {
            if (this.isCDATA(key)) {
                val += this.indentate(level);
                if (jObj[this.options.textNodeName]) {
                    val += this.replaceCDATAarr(jObj[this.options.textNodeName], jObj[key]);
                } else {
                    val += this.replaceCDATAarr("", jObj[key]);
                }
            } else {
                const arrLen = jObj[key].length;
                for(let j = 0; j < arrLen; j++){
                    const item = jObj[key][j];
                    if (typeof item === "undefined") ;
                    else if (item === null) {
                        val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
                    } else if (typeof item === "object") {
                        val += this.processTextOrObjNode(item, key, level);
                    } else {
                        val += this.buildTextNode(item, key, "", level);
                    }
                }
            }
        } else {
            if (this.options.attrNodeName && key === this.options.attrNodeName) {
                const Ks = Object.keys(jObj[key]);
                const L = Ks.length;
                for(let j = 0; j < L; j++){
                    attrStr += " " + Ks[j] + '="' + this.options.attrValueProcessor("" + jObj[key][Ks[j]]) + '"';
                }
            } else {
                val += this.processTextOrObjNode(jObj[key], key, level);
            }
        }
    }
    return {
        attrStr,
        val
    };
};
function processTextOrObjNode(object, key, level) {
    const result = this.j2x(object, level + 1);
    if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextNode(result.val, key, result.attrStr, level);
    } else {
        return this.buildObjNode(result.val, key, result.attrStr, level);
    }
}
function replaceCDATAstr(str, cdata) {
    str = this.options.tagValueProcessor("" + str);
    if (this.options.cdataPositionChar === "" || str === "") {
        return str + "<![CDATA[" + cdata + "]]" + this.tagEndChar;
    } else {
        return str.replace(this.options.cdataPositionChar, "<![CDATA[" + cdata + "]]" + this.tagEndChar);
    }
}
function replaceCDATAarr(str, cdata) {
    str = this.options.tagValueProcessor("" + str);
    if (this.options.cdataPositionChar === "" || str === "") {
        return str + "<![CDATA[" + cdata.join("]]><![CDATA[") + "]]" + this.tagEndChar;
    } else {
        for(let v in cdata){
            str = str.replace(this.options.cdataPositionChar, "<![CDATA[" + cdata[v] + "]]>");
        }
        return str + this.newLine;
    }
}
function buildObjectNode(val, key, attrStr, level) {
    if (attrStr && val.indexOf("<") === -1) {
        return this.indentate(level) + "<" + key + attrStr + ">" + val + "</" + key + this.tagEndChar;
    } else {
        return this.indentate(level) + "<" + key + attrStr + this.tagEndChar + val + this.indentate(level) + "</" + key + this.tagEndChar;
    }
}
function buildEmptyObjNode(val, key, attrStr, level) {
    if (val !== "") {
        return this.buildObjectNode(val, key, attrStr, level);
    } else {
        return this.indentate(level) + "<" + key + attrStr + "/" + this.tagEndChar;
    }
}
function buildTextValNode(val, key, attrStr, level) {
    return this.indentate(level) + "<" + key + attrStr + ">" + this.options.tagValueProcessor(val) + "</" + key + this.tagEndChar;
}
function buildEmptyTextNode(val, key, attrStr, level) {
    if (val !== "") {
        return this.buildTextValNode(val, key, attrStr, level);
    } else {
        return this.indentate(level) + "<" + key + attrStr + "/" + this.tagEndChar;
    }
}
function indentate(level) {
    return this.options.indentBy.repeat(level);
}
function isAttribute(name) {
    if (name.startsWith(this.options.attributeNamePrefix)) {
        return name.substr(this.attrPrefixLen);
    } else {
        return false;
    }
}
function isCDATA(name) {
    return name === this.options.cdataTagName;
}
var json2xml = Parser;
var parser = createCommonjsModule(function(module, exports) {
    const x2xmlnode = xmlstr2xmlnode;
    const buildOptions2 = util.buildOptions;
    exports.parse = function(xmlData, givenOptions = {}, validationOption) {
        if (validationOption) {
            if (validationOption === true) validationOption = {};
            const result = validator.validate(xmlData, validationOption);
            if (result !== true) {
                throw Error(result.err.msg);
            }
        }
        if (givenOptions.parseTrueNumberOnly && givenOptions.parseNodeValue !== false && !givenOptions.numParseOptions) {
            givenOptions.numParseOptions = {
                leadingZeros: false
            };
        }
        let options = buildOptions2(givenOptions, x2xmlnode.defaultOptions, x2xmlnode.props);
        const traversableObj = xmlstr2xmlnode.getTraversalObj(xmlData, options);
        return node2json.convertToJson(traversableObj, options);
    };
    exports.convertTonimn = nimndata.convert2nimn;
    exports.getTraversalObj = xmlstr2xmlnode.getTraversalObj;
    exports.convertToJson = node2json.convertToJson;
    exports.convertToJsonString = node2json_str.convertToJsonString;
    exports.validate = validator.validate;
    exports.j2xParser = json2xml;
    exports.parseToNimn = function(xmlData, schema, options) {
        return exports.convertTonimn(exports.getTraversalObj(xmlData, options), schema, options);
    };
});
parser.convertToJson;
parser.convertToJsonString;
parser.convertTonimn;
var getTraversalObj$1 = parser.getTraversalObj;
parser.j2xParser;
parser.parse;
parser.parseToNimn;
var validate$1 = parser.validate;
function encodeXml(unencoded) {
    return unencoded.replaceAll(/[&<>'"]/g, (__char)=>{
        return UNENCODED_CHARS_TO_ENTITIES[__char];
    });
}
function decodeXml(encoded, additionalEntities = {}) {
    return encoded.replaceAll(/&(#(\d+)|[a-z]+);/g, (str, entity, decimal)=>{
        if (typeof decimal === 'string') return String.fromCharCode(parseInt(decimal));
        if (typeof entity === 'string') {
            const additional = additionalEntities[entity];
            if (additional) return additional;
            const rt = ENTITIES_TO_UNENCODED_CHARS[entity];
            if (rt) return rt;
        }
        throw new Error(`Unsupported entity: ${str}`);
    });
}
const UNENCODED_CHARS_TO_ENTITIES = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '\'': '&#39;',
    '"': '&#34;'
};
const ENTITIES_TO_UNENCODED_CHARS = {
    'lt': '<',
    'gt': '>',
    'amp': '&',
    'apos': `'`,
    'quot': '"'
};
function validateXml(xml) {
    const rt = validate$1(xml);
    return rt === true ? rt : rt.err;
}
function parseXml(xml, opts = {}) {
    const { additionalEntities } = opts;
    const tagValueProcessor = (tagName)=>decodeXml(tagName, additionalEntities);
    const rt = getTraversalObj$1(xml, {
        ignoreAttributes: false,
        parseAttributeValue: false,
        parseNodeValue: false,
        tagValueProcessor
    });
    const namespaces = new XmlNamespaces();
    applyQnames(rt, namespaces);
    checkEqual('namespaces.stackSize', namespaces.stackSize, 0);
    return rt;
}
function computeAttributeMap(attrsMap) {
    let map;
    if (attrsMap) {
        for (const [name, value] of Object.entries(attrsMap)){
            if (!name.startsWith('@_')) throw new Error(`Bad attrsMap name: ${name}, ${attrsMap}`);
            map = map || new Map();
            map.set(name.substring(2), value);
        }
    }
    return map || EMPTY_STRING_MAP;
}
function findChildElements(node, ...qnames) {
    let rt;
    for (const value of Object.values(node.child)){
        for (const qname of qnames){
            for (const child of value){
                const extChild = child;
                if (qname.name === '*' ? qname.namespaceUri === extChild.qname.namespaceUri : qnameEq(qname, extChild.qname)) {
                    rt = rt || [];
                    rt.push(extChild);
                }
            }
        }
    }
    return rt || EMPTY_XML_NODE_ARRAY;
}
function findElementRecursive(root, test) {
    if (test(root)) return root;
    for (const value of Object.values(root.child)){
        for (const child of value){
            const extChild = child;
            const rt = findElementRecursive(extChild, test);
            if (rt) return rt;
        }
    }
    return undefined;
}
function qnameEq(lhs, rhs) {
    return lhs.name === rhs.name && lhs.namespaceUri === rhs.namespaceUri;
}
function qnamesInclude(lhs, rhs) {
    return lhs.some((v)=>qnameEq(v, rhs));
}
const EMPTY_STRING_MAP = new Map();
const EMPTY_XML_NODE_ARRAY = [];
function applyQnames(node, namespaces) {
    try {
        const atts = namespaces.push(node.attrsMap);
        const nodeAsAny = node;
        nodeAsAny.atts = atts;
        nodeAsAny.qname = computeQname(node.tagname, namespaces);
        for (const value of Object.values(node.child)){
            for (const childNode of value){
                applyQnames(childNode, namespaces);
            }
        }
    } finally{
        namespaces.pop();
    }
}
function computeQname(nameWithOptionalPrefix, namespaces) {
    const i = nameWithOptionalPrefix.indexOf(':');
    if (i < 0) return {
        name: nameWithOptionalPrefix,
        namespaceUri: namespaces.findNamespaceUri('')
    };
    return {
        name: nameWithOptionalPrefix.substring(i + 1),
        namespaceUri: namespaces.getNamespaceUri(nameWithOptionalPrefix.substring(0, i))
    };
}
class XmlNamespaces {
    stack = [];
    get stackSize() {
        return this.stack.length;
    }
    push(attrsMap) {
        const attrs = computeAttributeMap(attrsMap);
        let map;
        for (const [name, value] of attrs.entries()){
            if (name === 'xmlns') {
                map = map || new Map();
                map.set('', value);
            } else if (name.startsWith('xmlns:')) {
                map = map || new Map();
                const prefix = name.substring(6);
                map.set(prefix, value);
            }
        }
        this.stack.push(map || EMPTY_STRING_MAP);
        return attrs;
    }
    pop() {
        this.stack.pop();
    }
    findNamespaceUri(prefix) {
        for(let i = this.stack.length - 1; i >= 0; i--){
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        return undefined;
    }
    getNamespaceUri(prefix) {
        for(let i = this.stack.length - 1; i >= 0; i--){
            const rt = this.stack[i].get(prefix);
            if (rt) return rt;
        }
        throw new Error(`getNamespaceUri: prefix not found: ${prefix}`);
    }
}
function checkMatches(name, value, pattern) {
    if (!pattern.test(value)) throw new Error(`Bad ${name}: ${value}`);
    return value;
}
function checkEqual1(name, value, expected) {
    if (value !== expected) throw new Error(`Bad ${name}: ${value}, expected ${expected}`);
}
function checkTrue(name, value, test) {
    if (!test) throw new Error(`Bad ${name}: ${value}`);
}
function isStringRecord(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}
function isString(obj) {
    return typeof obj === 'string';
}
function isOptionalString(obj) {
    return typeof obj === 'string' || obj === undefined;
}
function isOptionalNumber(obj) {
    return typeof obj === 'number' || obj === undefined;
}
function isReadonlyArray(arg) {
    return Array.isArray(arg);
}
function isPodcastImagesSrcSet(trimmedText) {
    const widths = new Set();
    const densities = new Set();
    let withWidthCount = 0;
    const pieces = trimmedText.split(/,\s+/);
    for (const piece of pieces){
        const m = /^([^\s]+)(\s+(\d+w|\d+(\.\d+)?x))?$/.exec(piece);
        if (!m) return false;
        const url = m[1];
        const descriptor = m[3] || '';
        if (!isUrl(url)) return false;
        if (descriptor.endsWith('w')) {
            withWidthCount++;
            const width = parseInt(descriptor.substring(0, descriptor.length - 1));
            if (width <= 0) return false;
            if (widths.has(width)) return false;
            widths.add(width);
        } else {
            const density = descriptor.endsWith('x') ? parseFloat(descriptor.substring(0, descriptor.length - 1)) : 1;
            if (density <= 0) return false;
            if (densities.has(density)) return false;
            densities.add(density);
        }
    }
    if (withWidthCount > 0 && withWidthCount !== pieces.length) return false;
    return true;
}
function isNotEmpty(trimmedText) {
    return trimmedText.length > 0;
}
function isUrl(trimmedText) {
    const u = tryParseUrl(trimmedText);
    return u?.protocol === 'https:' || u?.protocol === 'http:';
}
function isUri(trimmedText) {
    return typeof trimmedText === 'string' && (tryParseUrl(trimmedText) !== undefined || /^at:\/\/([^/]+)(\/([^/]+)(\/([^/]+))?)?$/.test(trimmedText));
}
function isMimeType(trimmedText) {
    return /^\w+\/[-+.\w]+$/.test(trimmedText);
}
function isUuid(trimmedText) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(trimmedText);
}
function isEmailAddress(trimmedText) {
    return /^[^@\s]+@[^@\s]+$/.test(trimmedText);
}
function isEmailAddressWithOptionalName(trimmedText) {
    return /^[^@\s]+@[^@\s]+(\s+\(.*?\))?$/.test(trimmedText);
}
function isAtMostCharacters(maxCharacters) {
    return (trimmedText)=>trimmedText.length <= maxCharacters;
}
function isSeconds(trimmedText) {
    return /^\d+(\.\d+)?$/.test(trimmedText);
}
function isGeoLatLon(trimmedText) {
    return /^geo:-?\d+(\.\d+)?,-?\d+(\.\d+)?(,?\d+(\.\d+)?)?(;crs=[a-zA-Z0-9-]+)?(;u=\d+(\.\d+)?)?(;[a-zA-Z0-9-]+(=([\[\]:&+$_.!~*'()a-zA-Z0-9-]|%[0-9a-fA-F]{2})+)?)*$/.test(trimmedText);
}
function isOpenStreetMapIdentifier(trimmedText) {
    return /^[NWR]\d+(#\d+)?$/.test(trimmedText);
}
function isNonNegativeInteger(trimmedText) {
    return /^\d+$/.test(trimmedText) && parseInt(trimmedText) >= 0 && parseInt(trimmedText).toString() === trimmedText;
}
function isPositiveInteger(trimmedText) {
    return /^\d+$/.test(trimmedText) && parseInt(trimmedText) > 0 && parseInt(trimmedText).toString() === trimmedText;
}
function isIntegerBetween(startInclusive, endInclusive) {
    return (trimmedText)=>/^\d+$/.test(trimmedText) && parseInt(trimmedText) >= startInclusive && parseInt(trimmedText) <= endInclusive && parseInt(trimmedText).toString() === trimmedText;
}
function isDecimal(trimmedText) {
    return /^\d+(\.\d+)?$/.test(trimmedText);
}
function isRfc2822(trimmedText) {
    return /^[0-9A-Za-z, ]+ \d{2}:\d{2}(:\d{2})? ([-+]?[0-9]+|[A-Z]{3,})$/.test(trimmedText);
}
function isIso8601AllowTimezone(trimmedText) {
    return isIso8601(trimmedText, {
        allowTimezone: true
    });
}
function isIso8601(trimmedText, opts = {}) {
    const { allowTimezone } = opts;
    const m = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-](\d{2}|\d{4}|\d{2}:\d{2}))$/.exec(trimmedText);
    if (!m) return false;
    const tz = m[2];
    return allowTimezone || tz === 'Z';
}
function isBoolean(trimmedText) {
    return /^(true|false)$/.test(trimmedText);
}
function isYesNo(trimmedText) {
    return /^(yes|no)$/.test(trimmedText);
}
function isPodcastValueTypeSlug(trimmedText) {
    return /^[a-z]+$/.test(trimmedText);
}
function isPodcastMedium(trimmedText) {
    return /^[a-z]+L?$/.test(trimmedText);
}
function isPodcastSocialInteractProtocol(trimmedText) {
    return /^(disabled|activitypub|twitter|lightning|atproto|hive|matrix|nostr)$/.test(trimmedText);
}
function isPodcastServiceSlug(trimmedText) {
    return /^[a-z]{3,30}$/.test(trimmedText);
}
function isPodcastLiveItemStatus(trimmedText) {
    return /^(pending|live|ended)$/.test(trimmedText);
}
function isRssLanguage(trimmedText) {
    return /^[a-zA-Z]+(-[a-zA-Z]+)*$/.test(trimmedText);
}
function isItunesDuration(trimmedText) {
    return /^(\d+:)?\d+:\d+$/.test(trimmedText) || isNonNegativeInteger(trimmedText);
}
function isItunesType(trimmedText) {
    return /^(episodic|serial)$/.test(trimmedText);
}
function hasApplePodcastsSupportedFileExtension(url) {
    const u = tryParseUrl(url);
    return u !== undefined && /\.(m4a|mp3|mov|mp4|m4v|pdf)$/i.test(u.pathname);
}
function isRfc5545RecurrenceRule(trimmedText) {
    return isNotEmpty(trimmedText);
}
function isFullyQualifiedDomainName(value) {
    const u = tryParseUrl(`http://${value}`);
    return !!u && u.hostname === value;
}
function isAspectRatio(trimmedText) {
    return /^\d+(\.\d+)?\s*(\/\s*\d+(\.\d+)?)?$/.test(trimmedText);
}
function tryParseUrl(str, base) {
    try {
        return new URL(str, base);
    } catch  {
        return undefined;
    }
}
function validateFeedXml(xml, callbacks) {
    if (xml.tagname !== '!xml') return callbacks.onError(xml, `Bad xml.tagname: ${xml.tagname}`);
    if (Object.keys(xml.attrsMap).length > 0) return callbacks.onError(xml, `Bad xml.attrsMap: ${xml.attrsMap}`);
    const docElement = Object.values(xml.child).flatMap((v)=>v)[0];
    if (!docElement) return callbacks.onError(xml, `No xml root element`);
    validateRss(docElement, callbacks);
}
function podcastIndexReference(href) {
    return {
        ruleset: 'podcastindex',
        href
    };
}
function getSingleChild(node, name, callbacks, opts = {}) {
    const children = findChildElements(node, {
        name
    });
    if (children.length !== 1) {
        callbacks.onWarning(node, `Expected single <${name}> child element under <${node.tagname}>, found ${children.length === 0 ? 'none' : children.length}`, opts);
        return undefined;
    }
    return children[0];
}
function validateRss(rss, callbacks) {
    const opts = {
        reference: {
            ruleset: 'rss',
            href: 'https://cyber.harvard.edu/rss/rss.html#whatIsRss'
        }
    };
    if (rss.tagname !== 'rss') return callbacks.onError(rss, `Bad xml root tag: ${rss.tagname}, expected rss`, opts);
    const version = rss.atts.get('version');
    if (version !== '2.0') callbacks.onWarning(rss, `Bad rss.version: ${version}, expected 2.0`, opts);
    const itunesOpts = {
        reference: {
            ruleset: 'itunes',
            href: 'https://podcasters.apple.com/support/823-podcast-requirements#:~:text=Podcast%20RSS%20feed%20technical%20requirements'
        }
    };
    const hasItunesPrefix = findElementRecursive(rss, (v)=>v.tagname.startsWith('itunes:')) !== undefined;
    if (hasItunesPrefix) checkAttributeEqual(rss, 'xmlns:itunes', Qnames.Itunes.NAMESPACE, callbacks, itunesOpts);
    const hasContentPrefix = findElementRecursive(rss, (v)=>v.tagname.startsWith('content:')) !== undefined;
    if (hasContentPrefix) checkAttributeEqual(rss, 'xmlns:content', 'http://purl.org/rss/1.0/modules/content/', callbacks, itunesOpts);
    const channel = getSingleChild(rss, 'channel', callbacks, opts);
    if (!channel) return;
    validateChannel(channel, callbacks);
}
function validateChannel(channel, callbacks) {
    const opts = {
        reference: {
            ruleset: 'rss',
            href: 'https://cyber.harvard.edu/rss/rss.html#requiredChannelElements'
        }
    };
    const title = getSingleChild(channel, 'title', callbacks, opts);
    checkText(title, isNotEmpty, callbacks, opts);
    const link = getSingleChild(channel, 'link', callbacks, opts);
    checkText(link, isUrl, callbacks, opts);
    const description = getSingleChild(channel, 'description', callbacks, opts);
    checkText(description, isNotEmpty, callbacks, opts);
    const rssChannelImageReference = {
        ruleset: 'rss',
        href: 'https://cyber.harvard.edu/rss/rss.html#ltimagegtSubelementOfLtchannelgt'
    };
    const image = ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelImageReference, {
        name: 'image'
    }).checkRemainingAttributes().node;
    if (image) {
        ElementValidation.forRequiredSingleChild('channel image', image, callbacks, rssChannelImageReference, {
            name: 'url'
        }).checkValue(isUrl).checkRemainingAttributes();
        ElementValidation.forRequiredSingleChild('channel image', image, callbacks, rssChannelImageReference, {
            name: 'title'
        }).checkValue(isNotEmpty).checkRemainingAttributes();
        ElementValidation.forRequiredSingleChild('channel image', image, callbacks, rssChannelImageReference, {
            name: 'link'
        }).checkValue(isUrl).checkRemainingAttributes();
        ElementValidation.forSingleChild('channel image', image, callbacks, rssChannelImageReference, {
            name: 'width'
        }).checkValue(isPositiveInteger).checkRemainingAttributes();
        ElementValidation.forSingleChild('channel image', image, callbacks, rssChannelImageReference, {
            name: 'height'
        }).checkValue(isPositiveInteger).checkRemainingAttributes();
        ElementValidation.forSingleChild('channel image', image, callbacks, rssChannelImageReference, {
            name: 'description'
        }).checkValue(isNotEmpty).checkRemainingAttributes();
    }
    const rssChannelOptional = {
        ruleset: 'rss',
        href: 'https://cyber.harvard.edu/rss/rss.html#optionalChannelElements'
    };
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'language'
    }).checkValue(isRssLanguage).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'managingEditor'
    }).checkValue(isEmailAddressWithOptionalName).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'webMaster'
    }).checkValue(isEmailAddressWithOptionalName).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'pubDate'
    }).checkValue(isRfc2822).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'lastBuildDate'
    }).checkValue(isRfc2822).checkRemainingAttributes();
    for (const category of findChildElements(channel, {
        name: 'category '
    })){
        ElementValidation.forElement('channel category', category, callbacks, {
            ruleset: 'rss',
            href: 'https://cyber.harvard.edu/rss/rss.html#ltcategorygtSubelementOfLtitemgt'
        }).checkValue(isNotEmpty).checkOptionalAttribute('domain', isNotEmpty).checkRemainingAttributes();
    }
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'docs'
    }).checkValue(isUrl).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, rssChannelOptional, {
        name: 'ttl'
    }).checkValue(isNonNegativeInteger).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, itunesPodcastersGuide, Qnames.Itunes.type).checkValue(isItunesType).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/guid.md'), ...Qnames.PodcastIndex.guid).checkValue(isUuid, (guidText)=>{
        const version = guidText.charAt(14);
        if (version !== '5') {
            return `expected a UUIDv5, found a UUIDv${version}`;
        }
    }).checkRemainingAttributes();
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/locked.md'), ...Qnames.PodcastIndex.locked).checkValue((v)=>/^(yes|no)$/.test(v)).checkOptionalAttribute('owner', isEmailAddress).checkRemainingAttributes();
    for (const funding of findChildElements(channel, ...Qnames.PodcastIndex.funding)){
        ElementValidation.forElement('channel', funding, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/funding.md')).checkValue(isNotEmpty).checkValue(isAtMostCharacters(128)).checkRequiredAttribute('url', isUrl).checkRemainingAttributes();
    }
    checkPodcastPerson('channel', channel, callbacks);
    checkPodcastLocation('channel', channel, callbacks);
    for (const trailer of findChildElements(channel, ...Qnames.PodcastIndex.trailer)){
        ElementValidation.forElement('channel', trailer, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/trailer.md')).checkValue(isNotEmpty).checkValue(isAtMostCharacters(128)).checkRequiredAttribute('url', isUrl).checkRequiredAttribute('pubdate', isRfc2822).checkOptionalAttribute('length', isNonNegativeInteger).checkOptionalAttribute('type', isMimeType).checkOptionalAttribute('season', isNonNegativeInteger).checkRemainingAttributes();
    }
    checkPodcastLicense('channel', channel, callbacks);
    checkPodcastValue('channel', channel, callbacks);
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/medium.md'), ...Qnames.PodcastIndex.medium).checkValue(isPodcastMedium).checkRemainingAttributes();
    checkPodcastImages('channel', channel, callbacks);
    const liveItems = findChildElements(channel, ...Qnames.PodcastIndex.liveItem);
    let liveItemsValidated = 0;
    for (const liveItem of liveItems){
        if (liveItemsValidated < 1) {
            validateItem(liveItem, callbacks, 'liveItem');
            ElementValidation.forElement('channel', liveItem, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/live-item.md')).checkRequiredAttribute('status', isPodcastLiveItemStatus).checkRequiredAttribute('start', isIso8601AllowTimezone).checkRequiredAttribute('end', isIso8601AllowTimezone).checkRemainingAttributes();
            liveItemsValidated++;
        }
    }
    callbacks.onPodcastIndexLiveItemsFound(liveItems.length);
    const blocks = findChildElements(channel, ...Qnames.PodcastIndex.block);
    const blockReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/block.md');
    for (const block of blocks){
        ElementValidation.forElement('channel', block, callbacks, blockReference).checkOptionalAttribute('id', isPodcastServiceSlug).checkValue(isYesNo).checkRemainingAttributes();
    }
    ElementValidation.forSingleChild('channel', channel, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/discussions/492'), ...Qnames.PodcastIndex.complete).checkOptionalAttribute('archive', isUrl).checkValue(isYesNo).checkRemainingAttributes();
    checkPodcastTxt('channel', channel, callbacks);
    checkPodcastRemoteItem('channel', channel, callbacks);
    const podrollReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/podroll.md');
    const podroll = ElementValidation.forSingleChild('channel', channel, callbacks, podrollReference, ...Qnames.PodcastIndex.podroll).checkRemainingAttributes().node;
    if (podroll) {
        const level = 'podroll';
        const remoteItems = checkPodcastRemoteItem(level, podroll, callbacks);
        if (remoteItems.length === 0) callbacks.onWarning(channel, `Bad <${podroll.tagname}> value: must include at least one child <podcast:remoteItem> element`, {
            reference: podrollReference
        });
        checkPodcastTagUsage(podroll, callbacks);
    }
    const updateFrequencyReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/update-frequency.md');
    ElementValidation.forSingleChild('channel', channel, callbacks, updateFrequencyReference, ...Qnames.PodcastIndex.updateFrequency).checkValue(isAtMostCharacters(128)).checkOptionalAttribute('complete', isBoolean).checkOptionalAttribute('rrule', isRfc5545RecurrenceRule).checkOptionalAttribute('dtstart', isIso8601).checkRequiredAttribute('dtstart', isIso8601, (node)=>(node.atts.get('rrule') ?? '').includes('COUNT=')).checkRemainingAttributes();
    const podpingReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/podping.md');
    ElementValidation.forSingleChild('channel', channel, callbacks, podpingReference, ...Qnames.PodcastIndex.podping).checkOptionalAttribute('usesPodping', isBoolean).checkRemainingAttributes();
    checkPodcastChat('channel', channel, callbacks);
    checkPodcastSocialInteract('channel', channel, callbacks);
    const publisherReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/publisher.md');
    const value = ElementValidation.forSingleChild('channel', channel, callbacks, publisherReference, ...Qnames.PodcastIndex.publisher).checkRemainingAttributes().node;
    if (value) {
        checkPodcastRemoteItem('podcast:publisher', value, callbacks, publisherReference);
    }
    checkPodcastImage('channel', channel, callbacks);
    const socials = findChildElements(channel, ...Qnames.PodcastIndex.social);
    const socialReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/social/social.md#social-element');
    const socialSignUpReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/proposal-docs/social/social.md#socialsignup-element');
    for (const social of socials){
        ElementValidation.forElement('channel', social, callbacks, socialReference).checkRequiredAttribute('platform', isNotEmpty).checkRequiredAttribute('protocol', isNotEmpty).checkRequiredAttribute('accountId', isNotEmpty).checkRequiredAttribute('accountUrl', isUrl).checkOptionalAttribute('priority', isNonNegativeInteger).checkRemainingAttributes();
        const socialSignUps = findChildElements(channel, ...Qnames.PodcastIndex.socialSignUp);
        for (const socialSignUp of socialSignUps){
            ElementValidation.forElement('social', socialSignUp, callbacks, socialSignUpReference).checkRequiredAttribute('homeUrl', isUrl).checkRequiredAttribute('signUpUrl', isUrl).checkOptionalAttribute('priority', isNonNegativeInteger).checkRemainingAttributes();
        }
    }
    const badSocialSignups = findChildElements(channel, ...Qnames.PodcastIndex.socialSignUp);
    if (badSocialSignups.length > 0) {
        callbacks.onWarning(badSocialSignups[0], `Bad <${badSocialSignups[0].tagname}>: should be a child of <podcast:social>, not channel`);
    }
    checkPodcastTagUsage(channel, callbacks);
    const items = channel.child.item || [];
    let itemsWithEnclosuresCount = 0;
    let itemsValidated = 0;
    for (const item of items){
        if (itemsValidated < 1) {
            validateItem(item, callbacks, 'item');
            itemsValidated++;
        }
        const elements = findChildElements(item, {
            name: 'enclosure'
        });
        if (elements.length > 0) itemsWithEnclosuresCount++;
    }
    callbacks.onRssItemsFound(items.length, itemsWithEnclosuresCount);
}
function checkPodcastChat(level, node, callbacks) {
    const chatReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/chat.md');
    ElementValidation.forSingleChild(level, node, callbacks, chatReference, ...Qnames.PodcastIndex.chat).checkRequiredAttribute('server', isFullyQualifiedDomainName).checkRequiredAttribute('protocol', (v)=>/^irc|xmpp|nostr|matrix$/.test(v)).checkOptionalAttribute('accountId', isNotEmpty).checkOptionalAttribute('space', isNotEmpty).checkRemainingAttributes();
}
function checkPodcastPerson(level, node, callbacks) {
    for (const person of findChildElements(node, ...Qnames.PodcastIndex.person)){
        ElementValidation.forElement(level, person, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/person.md')).checkValue(isNotEmpty).checkValue(isAtMostCharacters(128)).checkOptionalAttribute('role', isNotEmpty).checkOptionalAttribute('group', isNotEmpty).checkOptionalAttribute('img', isUrl).checkOptionalAttribute('href', isUrl).checkRemainingAttributes();
    }
}
function checkPodcastLocation(level, node, callbacks) {
    for (const location of findChildElements(node, ...Qnames.PodcastIndex.location)){
        ElementValidation.forElement(level, location, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/location.md')).checkOptionalAttribute('rel', (v)=>/^subject|creator$/.test(v)).checkOptionalAttribute('geo', isGeoLatLon).checkOptionalAttribute('osm', isOpenStreetMapIdentifier).checkOptionalAttribute('country', (v)=>/^[A-Z]{2}$/i.test(v)).checkValue(isNotEmpty).checkValue(isAtMostCharacters(128)).checkRemainingAttributes();
    }
}
function checkPodcastImage(level, node, callbacks) {
    for (const image of findChildElements(node, ...Qnames.PodcastIndex.image)){
        ElementValidation.forElement(level, image, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/image.md')).checkRequiredAttribute('href', isUrl).checkOptionalAttribute('alt', isNotEmpty).checkOptionalAttribute('aspect-ratio', isAspectRatio).checkOptionalAttribute('width', isNonNegativeInteger).checkOptionalAttribute('height', isNonNegativeInteger).checkOptionalAttribute('type', isMimeType).checkOptionalAttribute('purpose', isAtMostCharacters(128)).checkRemainingAttributes();
    }
}
function checkPodcastLicense(level, node, callbacks) {
    ElementValidation.forSingleChild(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/license.md'), ...Qnames.PodcastIndex.license).checkOptionalAttribute('url', isUrl).checkValue(isNotEmpty).checkValue(isAtMostCharacters(128)).checkRemainingAttributes();
}
function checkPodcastValue(level, node, callbacks) {
    for (const valueElement of findChildElements(node, ...Qnames.PodcastIndex.value)){
        const value = ElementValidation.forElement(level, valueElement, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/value.md')).checkRequiredAttribute('type', isPodcastValueTypeSlug).checkRequiredAttribute('method', isNotEmpty).checkOptionalAttribute('suggested', isDecimal).checkRemainingAttributes().node;
        if (value) {
            for (const valueRecipient of findChildElements(value, ...Qnames.PodcastIndex.valueRecipient)){
                checkPodcastValueRecipient('value', valueRecipient, callbacks);
            }
            const valueTimeSplitReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/value-time-split.md');
            for (const valueTimeSplit of findChildElements(value, ...Qnames.PodcastIndex.valueTimeSplit)){
                ElementValidation.forElement('value', valueTimeSplit, callbacks, valueTimeSplitReference).checkRequiredAttribute('startTime', isDecimal).checkRequiredAttribute('duration', isDecimal).checkOptionalAttribute('remoteStartTime', isDecimal).checkOptionalAttribute('remotePercentage', isIntegerBetween(0, 100)).checkRemainingAttributes();
                const remoteItems = checkPodcastRemoteItem('valueTimeSplit', valueTimeSplit, callbacks);
                const valueRecipients = findChildElements(valueTimeSplit, ...Qnames.PodcastIndex.valueRecipient);
                for (const valueRecipient of valueRecipients){
                    checkPodcastValueRecipient('valueTimeSplit', valueRecipient, callbacks);
                }
                const validValue = remoteItems.length === 1 && valueRecipients.length === 0 || remoteItems.length === 0 && valueRecipients.length > 0;
                if (!validValue) callbacks.onWarning(valueElement, `Bad <${valueElement.tagname}> <podcast:valueTimeSplit> node value: expected a single <podcast:remoteItem> element OR one or more <podcast:valueRecipient> elements.`, {
                    reference: valueTimeSplitReference
                });
                checkPodcastTagUsage(valueTimeSplit, callbacks);
            }
            checkPodcastTagUsage(value, callbacks);
        }
    }
}
function checkPodcastImages(level, node, callbacks) {
    ElementValidation.forSingleChild(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/images-(deprecated).md'), ...Qnames.PodcastIndex.images).checkRequiredAttribute('srcset', isPodcastImagesSrcSet).checkRemainingAttributes();
}
function checkPodcastTxt(level, node, callbacks) {
    const txts = findChildElements(node, ...Qnames.PodcastIndex.txt);
    const txtReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/txt.md');
    for (const txt of txts){
        ElementValidation.forElement(level, txt, callbacks, txtReference).checkOptionalAttribute('purpose', isAtMostCharacters(128)).checkValue(isAtMostCharacters(4000)).checkRemainingAttributes();
    }
}
function checkPodcastRemoteItem(level, node, callbacks, publisherReference) {
    const remoteItems = findChildElements(node, ...Qnames.PodcastIndex.remoteItem);
    const remoteItemReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/remote-item.md');
    if (publisherReference && remoteItems.length > 1) {
        callbacks.onWarning(node, `Expected a single podcast:remoteItem`, {
            reference: publisherReference
        });
        return [];
    }
    for (const remoteItem of remoteItems){
        const val = ElementValidation.forElement(level, remoteItem, callbacks, remoteItemReference).checkOptionalAttribute('feedGuid', isNotEmpty).checkOptionalAttribute('feedUrl', isUrl).checkAtLeastOneAttributeRequired('feedGuid', 'feedUrl').checkOptionalAttribute('itemGuid', isNotEmpty).checkOptionalAttribute('medium', isPodcastMedium).checkOptionalAttribute('title', isNotEmpty).checkRemainingAttributes();
        if (publisherReference) val.checkRequiredAttribute('feedUrl', isUrl).checkRequiredAttribute('medium', (v)=>v === 'publisher');
    }
    return remoteItems;
}
function checkPodcastValueRecipient(level, node, callbacks) {
    ElementValidation.forElement(level, node, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/value-recipient.md')).checkOptionalAttribute('name', isNotEmpty).checkOptionalAttribute('customKey', isNotEmpty).checkOptionalAttribute('customValue', isNotEmpty).checkRequiredAttribute('type', isPodcastValueTypeSlug).checkRequiredAttribute('address', isNotEmpty).checkRequiredAttribute('split', isNonNegativeInteger).checkOptionalAttribute('fee', isBoolean).checkRemainingAttributes();
}
function checkPodcastSocialInteract(level, node, callbacks) {
    const socialInteracts = findChildElements(node, ...Qnames.PodcastIndex.socialInteract);
    const socialInteractReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/social-interact.md');
    for (const socialInteract of socialInteracts){
        ElementValidation.forElement(level, socialInteract, callbacks, socialInteractReference).checkRequiredAttribute('uri', isUri, socialInteract.atts.get('protocol') !== 'disabled').checkRequiredAttribute('protocol', isPodcastSocialInteractProtocol).checkOptionalAttribute('accountId', isNotEmpty).checkOptionalAttribute('accountUrl', isUrl).checkOptionalAttribute('priority', isNonNegativeInteger).checkRemainingAttributes();
        callbacks.onGood(socialInteract, `Found ${level} <podcast:socialInteract>, nice!`, {
            tag: 'social-interact',
            reference: socialInteractReference
        });
    }
}
function checkPodcastTagUsage(node, callbacks) {
    const known = new Set();
    const unknown = new Set();
    const namespaceUris = new Set();
    for (const element of findChildElements(node, ...Qnames.PodcastIndex.NAMESPACES.map((v)=>({
            name: '*',
            namespaceUri: v
        })))){
        const isKnown = Qnames.PodcastIndex.KNOWN_NAMES.has(element.qname.name);
        (isKnown ? known : unknown).add(element.qname.name);
        if (element.qname.namespaceUri) namespaceUris.add(element.qname.namespaceUri);
    }
    if (known.size + unknown.size > 0) {
        callbacks.onPodcastIndexTagNamesFound(known, unknown, namespaceUris);
    }
}
function checkAttributeEqual(node, attName, attExpectedValue, callbacks, opts = {}) {
    const attValue = node.atts.get(attName);
    if (!attValue) {
        callbacks.onWarning(node, `Missing <${node.tagname}> ${attName} attribute, expected ${attExpectedValue}`, opts);
    } else if (attValue !== attExpectedValue) {
        callbacks.onWarning(node, `Bad <${node.tagname}> ${attName} attribute value: ${attValue}, expected ${attExpectedValue}`, opts);
    }
}
function checkText(node, test, callbacks, opts = {}) {
    if (node) {
        const trimmedText = (node.val || '').trim();
        if (!test(trimmedText)) {
            callbacks.onWarning(node, `Bad <${node.tagname}> value: ${trimmedText === '' ? '<empty>' : trimmedText}`, opts);
        }
        return trimmedText;
    }
    return undefined;
}
function findFirstChildElement(node, qname, callbacks, opts = {}) {
    const elements = findChildElements(node, qname);
    if (elements.length === 0) {
        callbacks.onWarning(node, `Item is missing an <${qname.name}> element`, opts);
    } else {
        if (elements.length > 1) callbacks.onWarning(node, `Item has multiple <${qname.name}> elements`, opts);
        return elements[0];
    }
    return undefined;
}
const itunesPodcastersGuide = {
    ruleset: 'itunes',
    href: 'https://help.apple.com/itc/podcasts_connect/#/itcb54353390'
};
function validateItem(item, callbacks, itemTagName) {
    const itunesOpts1 = {
        reference: {
            ruleset: 'itunes',
            href: 'https://podcasters.apple.com/support/823-podcast-requirements#:~:text=Podcast%20RSS%20feed%20technical%20requirements'
        }
    };
    const itunesOpts2 = {
        reference: itunesPodcastersGuide
    };
    const title = findFirstChildElement(item, {
        name: 'title'
    }, callbacks, itunesOpts2);
    if (title) {
        checkText(title, isNotEmpty, callbacks, itunesOpts2);
    }
    const enclosure = findFirstChildElement(item, {
        name: 'enclosure'
    }, callbacks, itunesOpts2);
    if (enclosure) {
        const rssEnclosureOpts = {
            reference: {
                ruleset: 'rss',
                href: 'https://cyber.harvard.edu/rss/rss.html#ltenclosuregtSubelementOfLtitemgt'
            }
        };
        const url = enclosure.atts.get('url');
        if (!url) callbacks.onWarning(enclosure, `Missing ${itemTagName} <enclosure> url attribute`, rssEnclosureOpts);
        if (url && !isUrl(url)) callbacks.onWarning(enclosure, `Bad ${itemTagName} <enclosure> url attribute value: ${url}, expected url`, rssEnclosureOpts);
        if (url && !hasApplePodcastsSupportedFileExtension(url) && itemTagName === 'item') callbacks.onWarning(enclosure, `Bad ${itemTagName} <enclosure> url attribute file extension: ${url}, Apple Podcasts only supports .m4a, .mp3, .mov, .mp4, .m4v, and .pdf.`, itunesOpts2);
        const length = enclosure.atts.get('length');
        if (!length) callbacks.onWarning(enclosure, `Missing ${itemTagName} <enclosure> length attribute`, rssEnclosureOpts);
        if (length && !isNonNegativeInteger(length)) callbacks.onWarning(enclosure, `Bad ${itemTagName} <enclosure> length attribute value: ${length}, expected non-negative integer`, rssEnclosureOpts);
        const type = enclosure.atts.get('type');
        if (!type) callbacks.onWarning(enclosure, `Missing ${itemTagName} <enclosure> type attribute`, rssEnclosureOpts);
        if (type && !isMimeType(type)) callbacks.onWarning(enclosure, `Bad ${itemTagName} <enclosure> type attribute value: ${type}, expected MIME type`, rssEnclosureOpts);
    }
    const guid = findFirstChildElement(item, {
        name: 'guid'
    }, callbacks, itunesOpts1);
    if (guid) {
        const guidText = checkText(guid, isNotEmpty, callbacks, itunesOpts1);
        const rssGuidOpts = {
            reference: {
                ruleset: 'rss',
                href: 'https://cyber.harvard.edu/rss/rss.html#ltguidgtSubelementOfLtitemgt'
            }
        };
        const misspellings = [
            ...guid.atts.keys()
        ].filter((v)=>v !== 'isPermaLink' && v.toLowerCase() === 'ispermalink');
        for (const misspelling of misspellings){
            callbacks.onWarning(guid, `Bad ${itemTagName} <guid> isPermaLink attribute spelling: ${misspelling}`, rssGuidOpts);
        }
        const isPermaLink = guid.atts.get('isPermaLink') || 'true';
        if (isPermaLink === 'true' && guidText && !isUrl(guidText) && misspellings.length === 0) callbacks.onWarning(guid, `Bad ${itemTagName} <guid> value: ${guidText}, expected url when isPermaLink="true" or unspecified`, rssGuidOpts);
    }
    ElementValidation.forSingleChild(itemTagName, item, callbacks, itunesPodcastersGuide, Qnames.Itunes.duration).checkValue(isItunesDuration).checkRemainingAttributes();
    const transcripts = findChildElements(item, ...Qnames.PodcastIndex.transcript);
    for (const transcript of transcripts){
        ElementValidation.forElement(itemTagName, transcript, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/transcript.md')).checkRequiredAttribute('url', isUrl).checkRequiredAttribute('type', isMimeType).checkOptionalAttribute('language', isNotEmpty).checkOptionalAttribute('rel', isNotEmpty).checkRemainingAttributes();
    }
    ElementValidation.forSingleChild(itemTagName, item, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/chapters.md'), ...Qnames.PodcastIndex.chapters).checkRequiredAttribute('url', isUrl).checkRequiredAttribute('type', isMimeType).checkRemainingAttributes();
    const soundbites = findChildElements(item, ...Qnames.PodcastIndex.soundbite);
    for (const soundbite of soundbites){
        ElementValidation.forElement('item', soundbite, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/soundbite.md')).checkRequiredAttribute('startTime', isSeconds).checkRequiredAttribute('duration', isSeconds).checkValue(isAtMostCharacters(128)).checkRemainingAttributes();
    }
    checkPodcastPerson(itemTagName, item, callbacks);
    checkPodcastLocation(itemTagName, item, callbacks);
    ElementValidation.forSingleChild(itemTagName, item, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/season.md'), ...Qnames.PodcastIndex.season).checkOptionalAttribute('name', (v)=>isNotEmpty(v) && isAtMostCharacters(128)(v)).checkValue(isNonNegativeInteger).checkRemainingAttributes();
    ElementValidation.forSingleChild(itemTagName, item, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/episode.md'), ...Qnames.PodcastIndex.episode).checkOptionalAttribute('display', (v)=>isNotEmpty(v) && isAtMostCharacters(32)(v)).checkValue(isDecimal).checkRemainingAttributes();
    checkPodcastLicense(itemTagName, item, callbacks);
    const alternateEnclosures = findChildElements(item, ...Qnames.PodcastIndex.alternateEnclosure);
    for (const alternateEnclosure of alternateEnclosures){
        ElementValidation.forElement(itemTagName, alternateEnclosure, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/alternate-enclosure.md')).checkRequiredAttribute('type', isMimeType).checkRequiredAttribute('length', isNonNegativeInteger).checkOptionalAttribute('bitrate', isDecimal).checkOptionalAttribute('height', isNonNegativeInteger).checkOptionalAttribute('lang', isNotEmpty).checkOptionalAttribute('title', (v)=>isNotEmpty(v) && isAtMostCharacters(32)(v)).checkOptionalAttribute('rel', (v)=>isNotEmpty(v) && isAtMostCharacters(32)(v)).checkOptionalAttribute('codecs', isNotEmpty).checkOptionalAttribute('default', isBoolean).checkRemainingAttributes();
        ElementValidation.forSingleChild('alternateEnclosure', alternateEnclosure, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/integrity.md'), ...Qnames.PodcastIndex.integrity).checkRequiredAttribute('type', (v)=>/^(sri|pgp-signature)$/.test(v)).checkRequiredAttribute('value', isNotEmpty).checkRemainingAttributes();
        const sources = findChildElements(alternateEnclosure, ...Qnames.PodcastIndex.source);
        for (const source of sources){
            ElementValidation.forElement('alternateEnclosure', source, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/alternate-enclosure.md')).checkRequiredAttribute('uri', isUri).checkOptionalAttribute('contentType', isMimeType).checkRemainingAttributes();
        }
    }
    checkPodcastValue(itemTagName, item, callbacks);
    checkPodcastImages(itemTagName, item, callbacks);
    const contentLinks = findChildElements(item, ...Qnames.PodcastIndex.contentLink);
    for (const contentLink of contentLinks){
        ElementValidation.forElement(itemTagName, contentLink, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/content-link.md')).checkRequiredAttribute('href', isUrl).checkValue(isNotEmpty).checkRemainingAttributes();
    }
    checkPodcastSocialInteract('item', item, callbacks);
    checkPodcastTxt('item', item, callbacks);
    checkPodcastChat('item', item, callbacks);
    checkPodcastRemoteItem('item', item, callbacks);
    for (const funding of findChildElements(item, ...Qnames.PodcastIndex.funding)){
        ElementValidation.forElement(itemTagName, funding, callbacks, podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/tags/funding.md')).checkValue(isNotEmpty).checkValue(isAtMostCharacters(128)).checkRequiredAttribute('url', isUrl).checkRemainingAttributes();
    }
    checkPodcastImage(itemTagName, item, callbacks);
    checkPodcastTagUsage(item, callbacks);
}
class ElementValidation {
    static EMPTY_STRING_SET = new Set();
    node;
    level;
    callbacks;
    opts;
    remainingAttNames;
    constructor(level, node, callbacks, opts){
        this.level = level;
        this.node = node;
        this.callbacks = callbacks;
        this.opts = opts;
        this.remainingAttNames = node ? new Set(node.atts.keys()) : ElementValidation.EMPTY_STRING_SET;
    }
    static forElement(level, node, callbacks, reference) {
        return new ElementValidation(level, node, callbacks, {
            reference
        });
    }
    static forRequiredSingleChild(level, parent, callbacks, reference, qname) {
        const elements = findChildElements(parent, qname);
        if (elements.length === 1) {
            return new ElementValidation(level, elements[0], callbacks, {
                reference
            });
        }
        if (elements.length === 0) {
            callbacks.onWarning(parent, `Missing ${level} <${qname.name}>`, {
                reference
            });
        } else {
            callbacks.onWarning(elements[1], `Multiple ${level} <${qname.name}> elements are not allowed`, {
                reference
            });
        }
        return new ElementValidation(level, undefined, callbacks, {
            reference
        });
    }
    static forSingleChild(level, parent, callbacks, reference, ...qnames) {
        checkTrue('qnames.length', qnames.length, qnames.length > 0);
        const elements = findChildElements(parent, ...qnames);
        if (elements.length > 0) {
            if (elements.length > 1) callbacks.onWarning(elements[1], `Multiple ${level} <${elements[1].tagname}> elements are not allowed`, {
                reference
            });
            const element = elements[0];
            return new ElementValidation(level, element, callbacks, {
                reference
            });
        }
        return new ElementValidation(level, undefined, callbacks, {
            reference
        });
    }
    checkValue(test, additionalTest) {
        const { node, callbacks, opts } = this;
        if (node) {
            const trimmedText = checkText(node, test, callbacks, opts);
            if (trimmedText && additionalTest) {
                const warningSuffix = additionalTest(trimmedText);
                if (warningSuffix) {
                    callbacks.onWarning(node, `Bad <${node.tagname}> value: ${trimmedText === '' ? '<empty>' : trimmedText}, ${warningSuffix}`, opts);
                }
            }
        }
        return this;
    }
    checkRequiredAttribute(name, test, ifCondition = true) {
        const { node, callbacks, opts, level } = this;
        if (node) {
            if (typeof ifCondition === 'boolean' ? ifCondition : ifCondition(node)) {
                const value = node.atts.get(name);
                if (!value) callbacks.onWarning(node, `Missing ${level} <${node.tagname}> ${name} attribute`, opts);
                if (value && !test(value)) callbacks.onWarning(node, `Bad ${level} <${node.tagname}> ${name} attribute value: ${value}`, opts);
            }
            this.remainingAttNames.delete(name);
        }
        return this;
    }
    checkOptionalAttribute(name, test) {
        const { node, callbacks, opts, level } = this;
        if (node) {
            const value = node.atts.get(name);
            if (value && !test(value)) callbacks.onWarning(node, `Bad ${level} <${node.tagname}> ${name} attribute value: ${value}`, opts);
            this.remainingAttNames.delete(name);
        }
        return this;
    }
    checkAtLeastOneAttributeRequired(...names) {
        const { node, callbacks, opts, level } = this;
        if (node) {
            const values = names.map((v)=>node.atts.get(v)).filter(isString);
            if (values.length === 0) callbacks.onWarning(node, `Bad ${level} <${node.tagname}>: At least one of these attributes must be present: ${names.join(', ')}`, opts);
        }
        return this;
    }
    checkRemainingAttributes() {
        const { remainingAttNames, callbacks, node, opts, level } = this;
        if (node) {
            if (remainingAttNames.size > 0) {
                callbacks.onWarning(node, `Bad ${level} <${node.tagname}> attribute name${remainingAttNames.size > 1 ? 's' : ''}: ${[
                    ...remainingAttNames
                ].join(', ')}`, opts);
            }
        }
        return this;
    }
}
function setIntersect(lhs, rhs) {
    const rt = new Set();
    for (const item of lhs){
        if (rhs.has(item)) rt.add(item);
    }
    for (const item of rhs){
        if (lhs.has(item)) rt.add(item);
    }
    return rt;
}
function isNonEmpty(value) {
    return value.trim().length > 0;
}
function isStringRecord1(obj) {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}
function isReadonlyArray1(arg) {
    return Array.isArray(arg);
}
function isValidIso8601(text) {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(text);
}
class Bytes {
    static EMPTY = new Bytes(new Uint8Array(0));
    _bytes;
    length;
    constructor(bytes){
        this._bytes = bytes;
        this.length = bytes.length;
    }
    array() {
        return this._bytes;
    }
    async sha1() {
        const hash = await cryptoSubtle().digest('SHA-1', this._bytes);
        return new Bytes(new Uint8Array(hash));
    }
    concat(other) {
        const rt = new Uint8Array(this.length + other.length);
        rt.set(this._bytes);
        rt.set(other._bytes, this.length);
        return new Bytes(rt);
    }
    async gitSha1Hex() {
        return (await Bytes.ofUtf8(`blob ${this.length}\0`).concat(this).sha1()).hex();
    }
    async hmacSha1(key) {
        const cryptoKey = await cryptoSubtle().importKey('raw', key._bytes, {
            name: 'HMAC',
            hash: 'SHA-1'
        }, true, [
            'sign'
        ]);
        const sig = await cryptoSubtle().sign('HMAC', cryptoKey, this._bytes);
        return new Bytes(new Uint8Array(sig));
    }
    async sha256() {
        const hash = await cryptoSubtle().digest('SHA-256', this._bytes);
        return new Bytes(new Uint8Array(hash));
    }
    async hmacSha256(key) {
        const cryptoKey = await cryptoSubtle().importKey('raw', key._bytes, {
            name: 'HMAC',
            hash: 'SHA-256'
        }, true, [
            'sign'
        ]);
        const sig = await cryptoSubtle().sign('HMAC', cryptoKey, this._bytes);
        return new Bytes(new Uint8Array(sig));
    }
    hex() {
        const a = Array.from(this._bytes);
        return a.map((b)=>b.toString(16).padStart(2, '0')).join('');
    }
    static ofHex(hex) {
        if (hex === '') {
            return Bytes.EMPTY;
        }
        return new Bytes(new Uint8Array(hex.match(/.{1,2}/g).map((__byte)=>parseInt(__byte, 16))));
    }
    utf8() {
        return new TextDecoder().decode(this._bytes);
    }
    static ofUtf8(str) {
        return new Bytes(new TextEncoder().encode(str));
    }
    base64() {
        return base64Encode(this._bytes);
    }
    static ofBase64(base64, opts = {
        urlSafe: false
    }) {
        return new Bytes(base64Decode(base64, opts.urlSafe));
    }
    static async ofStream(stream) {
        const chunks = [];
        for await (const chunk of stream){
            chunks.push(chunk);
        }
        const len = chunks.reduce((prev, current)=>prev + current.length, 0);
        const rt = new Uint8Array(len);
        let offset = 0;
        for (const chunk of chunks){
            rt.set(chunk, offset);
            offset += chunk.length;
        }
        return new Bytes(rt);
    }
    static formatSize(sizeInBytes) {
        const sign = sizeInBytes < 0 ? '-' : '';
        let size = Math.abs(sizeInBytes);
        if (size < 1024) return `${sign}${size}bytes`;
        size = size / 1024;
        if (size < 1024) return `${sign}${roundToOneDecimal(size)}kb`;
        size = size / 1024;
        if (size < 1024) return `${sign}${roundToOneDecimal(size)}mb`;
        size = size / 1024;
        return `${sign}${roundToOneDecimal(size)}gb`;
    }
}
function roundToOneDecimal(value) {
    return Math.round(value * 10) / 10;
}
function base64Encode(buf) {
    const pieces = new Array(buf.length);
    for(let i = 0; i < buf.length; i++){
        pieces.push(String.fromCharCode(buf[i]));
    }
    return btoa(pieces.join(''));
}
function base64Decode(str, urlSafe) {
    if (urlSafe) str = str.replace(/_/g, '/').replace(/-/g, '+');
    str = atob(str);
    const length = str.length, buf = new ArrayBuffer(length), bufView = new Uint8Array(buf);
    for(let i = 0; i < length; i++){
        bufView[i] = str.charCodeAt(i);
    }
    return bufView;
}
function cryptoSubtle() {
    return crypto.subtle;
}
new TextEncoder();
async function findOrFetchJson(url, after, fetcher, cache, opts) {
    const response = await findOrFetchTextResponse(url, after, fetcher, cache, opts);
    const { status, headers, bodyText } = response;
    if (status !== 200) throw new Error(`Expected 200 response for ${url}, found ${status} body=${bodyText}`);
    const contentType = headers['content-type'] || '<none>';
    const foundJson = contentType.toLowerCase().includes('json') || contentType === '<none>' && bodyText.startsWith('{"');
    if (!foundJson) throw new Error(`Expected json response for ${url}, found ${contentType} body=${bodyText}`);
    return JSON.parse(bodyText);
}
function destructureThreadcapUrl(url) {
    const m = /^(at:\/\/)([^/]+)(\/.*?)$/.exec(url);
    const tmpUrl = m ? `${m[1]}${m[2].replaceAll(':', '%3A')}${m[3]}` : undefined;
    const m2 = /^(nostr:\/\/)(.+?)$/.exec(url);
    const tmpUrl2 = m2 ? `https://${m2[2]}` : undefined;
    const { protocol: tmpProtocol, hostname: tmpHostname, pathname, searchParams } = new URL(tmpUrl2 ?? tmpUrl ?? url);
    const protocol = m2 ? 'nostr:' : tmpProtocol;
    const hostname = tmpUrl2 ? tmpHostname : tmpUrl ? tmpHostname.replaceAll('%3A', ':') : tmpHostname;
    return {
        protocol,
        hostname,
        pathname,
        searchParams
    };
}
async function findOrFetchTextResponse(url, after, fetcher, cache, opts) {
    const existing = await cache.get(url, after);
    if (existing) return existing;
    const { accept, authorization } = opts;
    const headers = {
        accept
    };
    if (authorization) headers.authorization = authorization;
    const res = await fetcher(url, {
        headers
    });
    const response = {
        status: res.status,
        headers: objectFromEntries([
            ...res.headers
        ]),
        bodyText: await res.text()
    };
    await cache.put(url, new Date().toISOString(), response);
    return response;
}
function objectFromEntries(entries) {
    return [
        ...entries
    ].reduce((obj, [key, value])=>{
        obj[key] = value;
        return obj;
    }, {});
}
const ActivityPubProtocolImplementation = {
    initThreadcap: initActivityPubThreadcap,
    fetchComment: fetchActivityPubComment,
    fetchCommenter: fetchActivityPubCommenter,
    fetchReplies: fetchActivityPubReplies
};
async function mastodonFindReplies(id, opts) {
    const { after, fetcher, cache, debug } = opts;
    const statusId = await mastodonFindStatusIdForActivityPubId(id, after, fetcher, cache, debug);
    if (!statusId) return [];
    const { origin } = new URL(id);
    const url = new URL(origin);
    url.pathname = `/api/v1/statuses/${statusId}/context`;
    const obj = await findOrFetchJson(url.toString(), after, fetcher, cache, {
        accept: 'application/json'
    });
    if (debug) console.log(JSON.stringify(obj, undefined, 2));
    const rt = [];
    if (isStringRecord1(obj) && Array.isArray(obj.descendants)) {
        for (const descendant of obj.descendants){
            if (isStringRecord1(descendant) && typeof descendant.uri === 'string' && descendant.in_reply_to_id === statusId) {
                rt.push(descendant.uri);
            }
        }
    }
    return rt;
}
async function findOrFetchActivityPubObject(url, after, fetcher, cache) {
    return await findOrFetchJson(url, after, fetcher, cache, {
        accept: 'application/activity+json'
    });
}
async function initActivityPubThreadcap(url, opts) {
    const { fetcher, cache } = opts;
    const object = await findOrFetchActivityPubObject(url, new Date().toISOString(), fetcher, cache);
    const { id, type } = object;
    if (typeof type !== 'string') throw new Error(`Unexpected type for object: ${JSON.stringify(object)}`);
    if (!/^(Note|Article|Video|PodcastEpisode|Question)$/.test(type)) throw new Error(`Unexpected type: ${type}`);
    if (typeof id !== 'string') throw new Error(`Unexpected id for object: ${JSON.stringify(object)}`);
    return {
        protocol: 'activitypub',
        roots: [
            id
        ],
        nodes: {},
        commenters: {}
    };
}
async function fetchActivityPubComment(id, opts) {
    const { fetcher, cache, updateTime, callbacks } = opts;
    const object = await findOrFetchActivityPubObject(id, updateTime, fetcher, cache);
    return computeComment(object, id, callbacks);
}
async function fetchActivityPubCommenter(attributedTo, opts) {
    const { fetcher, cache, updateTime } = opts;
    const object = await findOrFetchActivityPubObject(attributedTo, updateTime, fetcher, cache);
    return computeCommenter(object, updateTime);
}
async function fetchActivityPubReplies(id, opts) {
    const { fetcher, cache, updateTime, callbacks, debug } = opts;
    const fetchedObject = await findOrFetchActivityPubObject(id, updateTime, fetcher, cache);
    const object = unwrapActivityIfNecessary(fetchedObject, id, callbacks);
    const replies = object.type === 'PodcastEpisode' ? object.comments : object.replies ?? object.comments;
    if (replies === undefined) {
        let message = object.type === 'PodcastEpisode' ? `No 'comments' found on PodcastEpisode object` : `No 'replies' found on object`;
        const tryPleromaWorkaround = id.includes('/objects/');
        if (tryPleromaWorkaround) {
            message += ', trying Pleroma workaround';
        }
        callbacks?.onEvent({
            kind: 'warning',
            url: id,
            nodeId: id,
            message,
            object
        });
        if (tryPleromaWorkaround) {
            return await mastodonFindReplies(id, {
                after: updateTime,
                fetcher,
                cache,
                debug
            });
        }
        return [];
    }
    const rt = [];
    const fetched = new Set();
    if (typeof replies === 'string') {
        const obj = await findOrFetchActivityPubObject(replies, updateTime, fetcher, cache);
        if (obj.type === 'OrderedCollection' || obj.type === 'OrderedCollectionPage') {
            return await collectRepliesFromOrderedCollection(obj, updateTime, id, fetcher, cache, callbacks, fetched);
        } else {
            throw new Error(`Expected 'replies' to point to an OrderedCollection, found ${JSON.stringify(obj)}`);
        }
    } else if (replies.first) {
        if (typeof replies.first === 'object' && replies.first.type === 'CollectionPage') {
            if (!replies.first.items && !replies.first.next) throw new Error(`Expected 'replies.first.items' or 'replies.first.next' to be present, found ${JSON.stringify(replies.first)}`);
            if (Array.isArray(replies.first.items) && replies.first.items.length > 0) {
                collectRepliesFromItems(replies.first.items, rt, id, id, callbacks);
            }
            if (replies.first.next) {
                if (typeof replies.first.next === 'string') {
                    rt.push(...await collectRepliesFromPages(replies.first.next, updateTime, id, fetcher, cache, callbacks, fetched));
                } else {
                    throw new Error(`Expected 'replies.first.next' to be a string, found ${JSON.stringify(replies.first.next)}`);
                }
            }
            return rt;
        } else {
            throw new Error(`Expected 'replies.first.items' array, or 'replies.first.next' string, found ${JSON.stringify(replies.first)}`);
        }
    } else if (Array.isArray(replies)) {
        if (replies.length > 0) throw new Error(`Expected 'replies' array to be empty, found ${JSON.stringify(replies)}`);
        return [];
    } else if (Array.isArray(replies.items)) {
        collectRepliesFromItems(replies.items, rt, id, id, callbacks);
        return rt;
    } else {
        throw new Error(`Expected 'replies' to be a string, array or object with 'first' or 'items', found ${JSON.stringify(replies)}`);
    }
}
async function collectRepliesFromOrderedCollection(orderedCollection, after, nodeId, fetcher, cache, callbacks, fetched) {
    if ((orderedCollection.items?.length || 0) > 0 || (orderedCollection.orderedItems?.length || 0) > 0) {
        throw new Error(`Expected OrderedCollection 'items'/'orderedItems' to be empty, found ${JSON.stringify(orderedCollection)}`);
    }
    if (orderedCollection.first === undefined && orderedCollection.totalItems === 0) {
        return [];
    } else if (typeof orderedCollection.first === 'string') {
        return await collectRepliesFromPages(orderedCollection.first, after, nodeId, fetcher, cache, callbacks, fetched);
    } else {
        throw new Error(`Expected OrderedCollection 'first' to be a string, found ${JSON.stringify(orderedCollection)}`);
    }
}
async function collectRepliesFromPages(url, after, nodeId, fetcher, cache, callbacks, fetched) {
    const replies = [];
    let page = await findOrFetchActivityPubObject(url, after, fetcher, cache);
    while(true){
        if (page.type !== 'CollectionPage' && page.type !== 'OrderedCollectionPage') {
            throw new Error(`Expected page 'type' of CollectionPage or OrderedCollectionPage, found ${JSON.stringify(page)}`);
        }
        if (page.items) {
            if (!Array.isArray(page.items)) throw new Error(`Expected page 'items' to be an array, found ${JSON.stringify(page)}`);
            collectRepliesFromItems(page.items, replies, nodeId, url, callbacks);
        }
        if (page.type === 'OrderedCollectionPage' && page.orderedItems) {
            if (!Array.isArray(page.orderedItems)) throw new Error(`Expected page 'orderedItems' to be an array, found ${JSON.stringify(page)}`);
            collectRepliesFromItems(page.orderedItems, replies, nodeId, url, callbacks);
        }
        if (page.next) {
            if (typeof page.next !== 'string') throw new Error(`Expected page 'next' to be a string, found ${JSON.stringify(page)}`);
            if (fetched.has(page.next)) return replies;
            page = await findOrFetchActivityPubObject(page.next, after, fetcher, cache);
            fetched.add(page.next);
        } else {
            return replies;
        }
    }
}
function unwrapActivityIfNecessary(object, id, callbacks) {
    if (object.type === 'Create' && isStringRecord1(object.object)) {
        callbacks?.onEvent({
            kind: 'warning',
            url: id,
            nodeId: id,
            message: 'Unwrapping a Create activity where an object was expected',
            object
        });
        return object.object;
    }
    return object;
}
function collectRepliesFromItems(items, outReplies, nodeId, url, callbacks) {
    for (const item of items){
        if (typeof item === 'string' && !item.startsWith('{')) {
            outReplies.push(item);
        } else {
            const itemObj = typeof item === 'string' ? JSON.parse(item) : item;
            const { id } = itemObj;
            if (typeof id !== 'string') throw new Error(`Expected item 'id' to be a string, found ${JSON.stringify(itemObj)}`);
            outReplies.push(id);
            if (typeof item === 'string') {
                callbacks?.onEvent({
                    kind: 'warning',
                    nodeId,
                    url,
                    message: 'Found item incorrectly double encoded as a json string',
                    object: itemObj
                });
            }
        }
    }
}
function computeComment(object, id, callbacks) {
    object = unwrapActivityIfNecessary(object, id, callbacks);
    const content = computeContent(object);
    const summary = computeSummary(object);
    const attachments = computeAttachments(object);
    const url = computeUrl(object.url) || id;
    const { published } = object;
    const attributedTo = computeAttributedTo(object.attributedTo);
    if (typeof published !== 'string') throw new Error(`Expected 'published' to be a string, found ${JSON.stringify(published)}`);
    const questionOptions = computeQuestionOptions(object);
    return {
        url,
        published,
        attachments,
        content,
        attributedTo,
        summary,
        questionOptions
    };
}
function computeUrl(url) {
    if (url === undefined || url === null) return undefined;
    if (typeof url === 'string') return url;
    if (Array.isArray(url)) {
        const v = url.find((v)=>v.type === 'Link' && v.mediaType === 'text/html' && typeof v.href === 'string');
        if (v) return v.href;
    }
    throw new Error(`Expected 'url' to be a string, found ${JSON.stringify(url)}`);
}
function computeQuestionOptions(obj) {
    let rt;
    if (obj.type === 'Question') {
        for (const prop of [
            'oneOf',
            'anyOf'
        ]){
            const val = obj[prop];
            if (Array.isArray(val)) {
                for (const item of val){
                    if (isStringRecord1(item) && item.type === 'Note' && typeof item.name === 'string') {
                        if (!rt) rt = [];
                        rt.push(item.name);
                    } else {
                        throw new Error(`Unsupported Question '${prop}' item: ${JSON.stringify(item)}`);
                    }
                }
                return rt;
            } else if (val !== undefined) {
                throw new Error(`Unsupported Question '${prop}' value: ${JSON.stringify(val)}`);
            }
        }
    }
    return rt;
}
function computeAttributedTo(attributedTo) {
    if (typeof attributedTo === 'string') return attributedTo;
    if (Array.isArray(attributedTo) && attributedTo.length > 0) {
        if (attributedTo.every((v)=>typeof v === 'string')) return attributedTo[0];
        if (attributedTo.every((v)=>isStringRecord1(v))) {
            for (const item of attributedTo){
                if (item.type === 'Person' && typeof item.id === 'string') {
                    return item.id;
                }
            }
            throw new Error(`Expected 'attributedTo' object array to have a Person with an 'id', found ${JSON.stringify(attributedTo)}`);
        }
    }
    throw new Error(`Expected 'attributedTo' to be a string or non-empty string/object array, found ${JSON.stringify(attributedTo)}`);
}
function computeContent(obj) {
    const rt = computeLanguageTaggedValues(obj, 'content', 'contentMap');
    if (!rt) throw new Error(`Expected either 'contentMap' or 'content' to be present ${JSON.stringify(obj)}`);
    return rt;
}
function computeSummary(obj) {
    return computeLanguageTaggedValues(obj, 'summary', 'summaryMap');
}
function computeLanguageTaggedValues(obj, stringProp, mapProp) {
    if (obj.type === 'PodcastEpisode' && isStringRecord1(obj.description) && obj.description.type === 'Note') obj = obj.description;
    const stringVal = obj[stringProp] ?? undefined;
    const mapVal = obj[mapProp] ?? undefined;
    if (stringVal !== undefined && typeof stringVal !== 'string') throw new Error(`Expected '${stringProp}' to be a string, found ${JSON.stringify(stringVal)}`);
    if (mapVal !== undefined && !(isStringRecord1(mapVal) && Object.values(mapVal).every((v)=>typeof v === 'string'))) throw new Error(`Expected '${mapProp}' to be a string record, found ${JSON.stringify(mapVal)}`);
    if (mapVal !== undefined) return mapVal;
    if (stringVal !== undefined) return {
        und: stringVal
    };
    if (obj.type === 'Video' && typeof obj.name === 'string' && isNonEmpty(obj.name)) return {
        und: obj.name
    };
}
function computeAttachments(object) {
    const rt = [];
    if (!object.attachment) return rt;
    const attachments = isReadonlyArray1(object.attachment) ? object.attachment : [
        object.attachment
    ];
    for (const attachment of attachments){
        rt.push(computeAttachment(attachment));
    }
    return rt;
}
function computeAttachment(object) {
    if (typeof object !== 'object' || object.type !== 'Document' && object.type !== 'Image') throw new Error(`Expected attachment 'type' of Document or Image, found ${JSON.stringify(object.type)}`);
    const { mediaType, width, height, url } = object;
    if (typeof mediaType !== 'string') throw new Error(`Expected attachment 'mediaType' to be a string, found ${JSON.stringify(mediaType)}`);
    if (width !== undefined && typeof width !== 'number') throw new Error(`Expected attachment 'width' to be a number, found ${JSON.stringify(width)}`);
    if (height !== undefined && typeof height !== 'number') throw new Error(`Expected attachment 'height' to be a number, found ${JSON.stringify(height)}`);
    if (typeof url !== 'string') throw new Error(`Expected attachment 'url' to be a string, found ${JSON.stringify(url)}`);
    return {
        mediaType,
        width,
        height,
        url
    };
}
function computeCommenter(person, asof) {
    let icon;
    if (person.icon) {
        if (typeof person.icon !== 'object' || isReadonlyArray1(person.icon) || person.icon.type !== 'Image') throw new Error(`Expected person 'icon' to be an object, found: ${JSON.stringify(person.icon)}`);
        icon = computeIcon(person.icon);
    }
    const { name, preferredUsername, url: apUrl, id } = person;
    if (name !== undefined && typeof name !== 'string') throw new Error(`Expected person 'name' to be a string, found: ${JSON.stringify(person)}`);
    if (preferredUsername !== undefined && typeof preferredUsername !== 'string') throw new Error(`Expected person 'preferredUsername' to be a string, found: ${JSON.stringify(person)}`);
    const nameOrPreferredUsername = name || preferredUsername;
    if (!nameOrPreferredUsername) throw new Error(`Expected person 'name' or 'preferredUsername', found: ${JSON.stringify(person)}`);
    if (apUrl !== undefined && typeof apUrl !== 'string') throw new Error(`Expected person 'url' to be a string, found: ${JSON.stringify(apUrl)}`);
    const url = apUrl || id;
    if (typeof url !== 'string') throw new Error(`Expected person 'url' or 'id' to be a string, found: ${JSON.stringify(url)}`);
    const fqUsername = computeFqUsername(url, person.preferredUsername);
    return {
        icon,
        name: nameOrPreferredUsername,
        url,
        fqUsername,
        asof
    };
}
function computeIcon(image) {
    const { url, mediaType } = image;
    if (typeof url !== 'string') throw new Error(`Expected icon 'url' to be a string, found: ${JSON.stringify(url)}`);
    if (mediaType !== undefined && typeof mediaType !== 'string') throw new Error(`Expected icon 'mediaType' to be a string, found: ${JSON.stringify(mediaType)}`);
    return {
        url,
        mediaType
    };
}
function computeFqUsername(url, preferredUsername) {
    const u = new URL(url);
    const m = /^\/(@[^\/]+)$/.exec(u.pathname);
    const username = m ? m[1] : preferredUsername;
    if (!username) throw new Error(`Unable to compute username from url: ${url}`);
    return `${username}@${u.hostname}`;
}
async function mastodonFindStatusIdForActivityPubId(id, after, fetcher, cache, debug) {
    const { origin } = new URL(id);
    const url = new URL(origin);
    url.pathname = '/api/v2/search';
    url.searchParams.set('q', id);
    url.searchParams.set('type', 'statuses');
    const obj = await findOrFetchJson(url.toString(), after, fetcher, cache, {
        accept: 'application/json'
    });
    if (debug) console.log(JSON.stringify(obj, undefined, 2));
    if (isStringRecord1(obj) && Array.isArray(obj.statuses) && obj.statuses.length === 1) {
        const status = obj.statuses[0];
        if (isStringRecord1(status) && typeof status.id === 'string' && status.id !== '') {
            return status.id;
        }
    }
    return undefined;
}
const BlueskyProtocolImplementation = {
    async initThreadcap (url, opts) {
        const { uri, nodes, commenters } = await getThread(url, opts, 1000);
        return {
            protocol: 'bluesky',
            roots: [
                uri
            ],
            nodes,
            commenters
        };
    },
    async fetchComment (id, opts) {
        const { uri, nodes } = await getThread(id, opts, 0);
        const node = nodes[uri];
        if (!node) throw new Error(`fetchComment: no node!`);
        if (!node.comment) throw new Error(`fetchComment: no node comment!`);
        return node.comment;
    },
    async fetchCommenter (attributedTo, opts) {
        const { updateTime, fetcher, cache, bearerToken } = opts;
        const res = await getProfile(attributedTo, {
            updateTime,
            fetcher,
            cache,
            bearerToken
        });
        return computeCommenter1(res, updateTime);
    },
    async fetchReplies (id, opts) {
        const { uri, nodes } = await getThread(id, opts, 1);
        const node = nodes[uri];
        if (!node) throw new Error(`fetchReplies: no node!`);
        if (!node.replies) throw new Error(`fetchReplies: no node replies!`);
        return node.replies;
    }
};
function makeUrl(url, queryParams) {
    const u = new URL(url);
    Object.entries(queryParams).forEach(([n, v])=>u.searchParams.set(n, v.toString()));
    return u.toString();
}
function isGetPostThreadResponse(obj) {
    return isStringRecord1(obj) && isThreadViewPost(obj.thread);
}
function isThreadViewPost(obj) {
    return isStringRecord1(obj) && obj['$type'] === 'app.bsky.feed.defs#threadViewPost' && isStringRecord1(obj.post) && typeof obj.post.uri === 'string' && isStringRecord1(obj.post.author) && typeof obj.post.author.did === 'string' && typeof obj.post.author.handle === 'string' && (obj.post.author.displayName === undefined || typeof obj.post.author.displayName === 'string') && (obj.post.author.avatar === undefined || typeof obj.post.author.avatar === 'string') && Array.isArray(obj.post.author.labels) && isStringRecord1(obj.post.record) && obj.post.record['$type'] === 'app.bsky.feed.post' && typeof obj.post.record.text === 'string' && (obj.post.replyCount === undefined || typeof obj.post.replyCount === 'number') && (obj.replies === undefined || Array.isArray(obj.replies) && obj.replies.every(isThreadViewPost));
}
function isGetProfileResponse(obj) {
    return isStringRecord1(obj) && typeof obj.did === 'string' && typeof obj.handle === 'string' && typeof obj.displayName === 'string' && (obj.avatar === undefined || typeof obj.avatar === 'string');
}
async function fetchAppviewJson(url, { updateTime, fetcher, cache, bearerToken }) {
    return await findOrFetchJson(url, updateTime, fetcher, cache, {
        accept: 'application/json',
        authorization: bearerToken ? `Bearer ${bearerToken}` : undefined
    });
}
async function getProfile(handleOrDid, { updateTime, fetcher, cache, bearerToken }) {
    const res = await fetchAppviewJson(makeUrl('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile', {
        actor: handleOrDid
    }), {
        updateTime,
        fetcher,
        cache,
        bearerToken
    });
    if (!isGetProfileResponse(res)) throw new Error(JSON.stringify(res, undefined, 2));
    return res;
}
async function getThread(url, opts, depth) {
    const { debug, fetcher, updateTime = new Date().toISOString(), cache, bearerToken } = opts;
    const { protocol, pathname } = destructureThreadcapUrl(url);
    const resolveDid = async (handleOrDid)=>{
        if (handleOrDid.startsWith('did:')) return handleOrDid;
        const res = await getProfile(handleOrDid, {
            updateTime,
            fetcher,
            cache,
            bearerToken
        });
        return res.did;
    };
    const atUri = await (async ()=>{
        if (protocol === 'at:') return url;
        if (protocol === 'https:') {
            const [_, handleOrDid, postId] = /^\/profile\/([^/]+)\/post\/([^/]+)$/.exec(pathname) ?? [];
            if (handleOrDid && postId) return `at://${await resolveDid(handleOrDid)}/app.bsky.feed.post/${postId}`;
        }
        throw new Error(`Unexpected bluesky url: ${url}`);
    })();
    const res = await fetchAppviewJson(makeUrl('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread', {
        uri: atUri,
        depth,
        parentHeight: 0
    }), {
        updateTime,
        fetcher,
        cache,
        bearerToken
    });
    if (!isGetPostThreadResponse(res)) throw new Error(`Expected GetPostThreadResponse: ${JSON.stringify(res, undefined, 2)}`);
    if (debug) console.log(JSON.stringify(res, undefined, 2));
    const nodes = {};
    const commenters = {};
    const processThread = (thread)=>{
        const { uri, author, replyCount } = thread.post;
        let replies;
        let repliesAsof;
        if (replyCount === undefined) {
            if (thread.replies !== undefined) throw new Error(`Expected no thread.replies for undefined replyCount`);
        } else {
            if (thread.replies !== undefined) {
                replies = [];
                for (const reply of thread.replies){
                    const replyUri = processThread(reply);
                    replies.push(replyUri);
                }
                repliesAsof = updateTime;
            }
        }
        nodes[uri] = {
            replies,
            repliesAsof,
            comment: {
                attachments: [],
                content: {
                    und: thread.post.record.text
                },
                attributedTo: author.did
            },
            commentAsof: updateTime
        };
        commenters[author.did] = computeCommenter1(author, updateTime);
        return uri;
    };
    const uri = processThread(res.thread);
    return {
        uri,
        nodes,
        commenters
    };
}
function computeCommenter1(author, updateTime) {
    return {
        asof: updateTime,
        name: author.displayName ?? author.handle,
        fqUsername: author.handle,
        icon: author.avatar ? {
            url: author.avatar
        } : undefined
    };
}
const NostrProtocolImplementation = {
    async initThreadcap (url, opts) {
        const { debug, updateTime = new Date().toISOString() } = opts;
        const { protocol, hostname, searchParams } = destructureThreadcapUrl(url);
        const m = /^30311:([0-9a-f]{64}):(.*?)$/.exec(searchParams.get('space') ?? '');
        if (protocol !== 'nostr:' || !m) throw new Error(`Threadcap nostr urls should be in this form: nostr://<relay-server>?space=30311:<64-hexchars>:<identifer>`);
        const [space, _, identifier] = m;
        const limit = parseInt(searchParams.get('limit') ?? '1000');
        const dumpActivities = (searchParams.get('dump') ?? '').includes('activities');
        const nodes = {};
        const commenters = {};
        const makeUri = ({ message })=>{
            const u = new URL(`${protocol}//${hostname}`);
            u.searchParams.set('space', space);
            if (message !== undefined) u.searchParams.set('message', message);
            return u.toString();
        };
        const state = {};
        const pubkeys = new Set();
        const messages = await query({
            kinds: [
                1311
            ],
            limit,
            tags: {
                '#a': [
                    space
                ]
            }
        }, {
            hostname,
            debug,
            state
        });
        for (const message of messages){
            const uri = makeUri({
                message: message.id
            });
            nodes[uri] = {
                comment: {
                    attachments: [],
                    attributedTo: message.pubkey,
                    content: {
                        un: message.content
                    },
                    published: new Date(message.created_at * 1000).toISOString()
                },
                commentAsof: updateTime,
                replies: [],
                repliesAsof: updateTime
            };
            pubkeys.add(message.pubkey);
        }
        const activities = await query({
            kinds: [
                30311
            ],
            limit: 1000,
            tags: dumpActivities ? undefined : {
                '#d': [
                    identifier
                ]
            }
        }, {
            hostname,
            debug,
            state
        });
        if (dumpActivities) console.log(activities.map((v)=>`activity: ${v.tags.find((v)=>v[0] === 'd')?.at(1)}\t${v.tags.find((v)=>v[0] === 'title')?.at(1)}`).join('\n'));
        const activity = activities.find((v)=>v.tags.some((v)=>v[0] === 'd' && v[1] === identifier));
        const rootUri = makeUri({
            message: undefined
        });
        nodes[rootUri] = {
            comment: {
                attachments: [],
                attributedTo: activity ? activity.pubkey : '',
                content: {
                    un: activity?.tags.find((v)=>v[0] === 'title')?.at(1) ?? ''
                },
                published: activity ? new Date(activity.created_at * 1000).toISOString() : undefined
            },
            commentAsof: updateTime,
            replies: Object.keys(nodes).sort((lhs, rhs)=>nodes[lhs].comment.published.localeCompare(nodes[rhs].comment.published)),
            repliesAsof: updateTime
        };
        if (activity) pubkeys.add(activity.pubkey);
        const relaysForProfiles = [
            hostname,
            'relay.primal.net',
            'relay.damus.io',
            'relay.snort.social'
        ];
        const remainingPubkeys = new Set(pubkeys);
        const allProfiles = [];
        const resolvedByHostname = {};
        for (const relayForProfiles of relaysForProfiles){
            let resolved = 0;
            const profiles = await query({
                kinds: [
                    0
                ],
                authors: [
                    ...remainingPubkeys
                ]
            }, {
                hostname: relayForProfiles,
                state,
                debug
            });
            allProfiles.push(...profiles);
            for (const profile of profiles){
                remainingPubkeys.delete(profile.pubkey);
                resolved++;
            }
            resolvedByHostname[relayForProfiles] = resolved;
            if (remainingPubkeys.size === 0) break;
        }
        resolvedByHostname['unresolved'] = pubkeys.size - Object.values(resolvedByHostname).reduce((prev, cur)=>prev + cur, 0);
        for (const pubkey of pubkeys){
            const profile = allProfiles.find((v)=>v.pubkey === pubkey);
            if (profile) {
                const { name, display_name, picture, website, lud16 } = JSON.parse(profile.content);
                commenters[pubkey] = {
                    name: display_name ?? name ?? pubkey,
                    fqUsername: lud16,
                    icon: picture ? {
                        url: picture
                    } : undefined,
                    url: website,
                    asof: updateTime
                };
            } else {
                commenters[pubkey] = {
                    name: pubkey,
                    asof: updateTime
                };
            }
        }
        if (debug) console.log(JSON.stringify({
            resolvedByHostname
        }));
        return {
            protocol: 'nostr',
            roots: [
                rootUri
            ],
            nodes,
            commenters
        };
    },
    async fetchComment (id, opts) {
        await Promise.resolve();
        throw new Error(`fetchComment(${JSON.stringify({
            id,
            opts
        })}) not implemented`);
    },
    async fetchCommenter (attributedTo, opts) {
        await Promise.resolve();
        return {
            name: attributedTo,
            asof: opts.updateTime
        };
    },
    async fetchReplies (id, opts) {
        await Promise.resolve();
        throw new Error(`fetchReplies(${JSON.stringify({
            id,
            opts
        })}) not implemented`);
    }
};
function promiseWithResolvers() {
    let resolve = ()=>{};
    let reject = ()=>{};
    let done = false;
    const promise = new Promise(function(resolve_, reject_) {
        resolve = (value)=>{
            done = true;
            resolve_(value);
        };
        reject = (reason)=>{
            done = true;
            reject_(reason);
        };
    });
    return {
        resolve,
        reject,
        promise,
        done: ()=>done
    };
}
async function query(filter, opts) {
    const { hostname, debug, state } = opts;
    const ws = await (async ()=>{
        const stateKey = `ws-${hostname}`;
        const existing = state[stateKey];
        if (existing) return existing;
        const { resolve, reject, promise } = promiseWithResolvers();
        const ws = new WebSocket(`wss://${hostname}`);
        state[stateKey] = ws;
        ws.onopen = ()=>{
            if (debug) console.log('onopen');
            resolve(undefined);
        };
        ws.addEventListener('error', ()=>reject());
        ws.addEventListener('close', ()=>reject());
        await promise;
        return ws;
    })();
    const subscriptionId = crypto.randomUUID();
    const { resolve, reject, promise, done } = promiseWithResolvers();
    const send = (arr)=>{
        const json = JSON.stringify(arr);
        if (debug) console.log(`send: ${ws.readyState} ${json}`);
        ws.send(json);
    };
    const rt = [];
    ws.addEventListener('message', ({ data })=>{
        if (done()) return;
        if (debug) console.log(`onmessage: ${typeof data === 'string' && data.startsWith('[') && data.endsWith(']') ? JSON.stringify(JSON.parse(data), undefined, 2) : JSON.stringify(data)}`);
        let parsed;
        try {
            if (typeof data !== 'string') throw new Error(`Unexpected data type: ${typeof data} ${data}`);
            parsed = JSON.parse(data);
            if (!Array.isArray(parsed)) throw new Error(`Unexpected payload`);
            const [first, ...rest] = parsed;
            if (first === 'EOSE') {
                const [sub] = rest;
                if (sub === subscriptionId) send([
                    'CLOSE',
                    subscriptionId
                ]);
                resolve(rt);
            } else if (first === 'CLOSED') {
                const [sub, reason] = rest;
                if (sub === subscriptionId) throw new Error(`relay closed subscription: ${reason}`);
            } else if (first === 'EVENT') {
                const [sub, event] = rest;
                if (sub === subscriptionId) rt.push(event);
            }
        } catch (e) {
            reject(`onmessage: ${e.message}${parsed ? ` (${JSON.stringify(parsed)})` : ''}`);
        }
    });
    ws.addEventListener('close', ({ code, reason, wasClean })=>{
        if (done()) return;
        const msg = `onclose ${subscriptionId} ${JSON.stringify({
            code,
            reason,
            wasClean
        })}`;
        if (debug) console.log(msg);
        reject(msg);
    });
    const { kinds, limit, tags, authors } = filter;
    send([
        'REQ',
        subscriptionId,
        {
            kinds,
            limit,
            ...tags,
            authors
        }
    ]);
    return promise;
}
const TwitterProtocolImplementation = {
    async initThreadcap (url, opts) {
        const { debug } = opts;
        const { hostname, pathname } = new URL(url);
        const m = /^\/.*?\/status\/(\d+)$/.exec(pathname);
        if (!/^(mobile\.)?twitter\.com$/.test(hostname) || !m) throw new Error(`Unexpected tweet url: ${url}`);
        const [_, id] = m;
        const tweetApiUrl = `https://api.twitter.com/2/tweets/${id}`;
        const obj = await findOrFetchTwitter(tweetApiUrl, new Date().toISOString(), opts);
        if (debug) console.log(JSON.stringify(obj, undefined, 2));
        return {
            protocol: 'twitter',
            roots: [
                tweetApiUrl
            ],
            nodes: {},
            commenters: {}
        };
    },
    async fetchComment (id, opts) {
        const { updateTime, debug, state } = opts;
        if (typeof state.conversationId === 'string') {
            const conversation = await findOrFetchConversation(state.conversationId, opts);
            const tweetId = id.split('/').pop();
            const tweet = conversation.tweets[tweetId];
            if (!tweet) throw new Error(`fetchComment: tweet ${tweetId} not found in conversation`);
            return computeCommentFromTweetObj(tweet);
        }
        const url = new URL(id);
        url.searchParams.set('tweet.fields', 'author_id,lang,created_at');
        const obj = await findOrFetchTwitter(url.toString(), updateTime, opts);
        if (debug) console.log(JSON.stringify(obj, undefined, 2));
        return computeCommentFromTweetObj(obj.data);
    },
    async fetchCommenter (attributedTo, opts) {
        const { updateTime, debug, state } = opts;
        if (typeof state.conversationId === 'string') {
            const conversation = await findOrFetchConversation(state.conversationId, opts);
            const userId = attributedTo.split('/').pop();
            const user = conversation.users[userId];
            if (!user) throw new Error(`fetchCommenter: user ${userId} not found in conversation`);
            return computeCommenterFromUserObj(user, updateTime);
        }
        const url = new URL(attributedTo);
        url.searchParams.set('user.fields', 'profile_image_url');
        const obj = await findOrFetchTwitter(url.toString(), updateTime, opts);
        if (debug) console.log('fetchCommenter', JSON.stringify(obj, undefined, 2));
        return computeCommenterFromUserObj(obj.data, updateTime);
    },
    async fetchReplies (id, opts) {
        const m = /^https:\/\/api\.twitter\.com\/2\/tweets\/(.*?)$/.exec(id);
        if (!m) throw new Error(`Unexpected tweet id: ${id}`);
        const [_, tweetId] = m;
        const convo = await findOrFetchConversation(tweetId, opts);
        return Object.values(convo.tweets).filter((v)=>v.referenced_tweets.some((w)=>w.type === 'replied_to' && w.id === tweetId)).map((v)=>`https://api.twitter.com/2/tweets/${v.id}`);
    }
};
function computeCommenterFromUserObj(obj, asof) {
    const name = obj.name;
    const fqUsername = '@' + obj.username;
    const userUrl = `https://twitter.com/${obj.username}`;
    const iconUrl = obj.profile_image_url;
    const iconUrlLower = (iconUrl || '').toLowerCase();
    const iconMediaType = iconUrlLower.endsWith('.jpg') ? 'image/jpeg' : iconUrlLower.endsWith('.png') ? 'image/png' : undefined;
    const icon = iconUrl ? {
        url: iconUrl,
        mediaType: iconMediaType
    } : undefined;
    return {
        asof,
        name,
        fqUsername,
        url: userUrl,
        icon
    };
}
function computeCommentFromTweetObj(obj) {
    const tweetId = obj.id;
    const text = obj.text;
    const authorId = obj.author_id;
    const lang = obj.lang;
    const createdAt = obj.created_at;
    const content = {};
    content[lang] = text;
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;
    return {
        attachments: [],
        attributedTo: `https://api.twitter.com/2/users/${authorId}`,
        content,
        published: createdAt,
        url: tweetUrl
    };
}
async function findOrFetchTwitter(url, after, opts) {
    const { fetcher, cache, bearerToken } = opts;
    const obj = await findOrFetchJson(url, after, fetcher, cache, {
        accept: 'application/json',
        authorization: `Bearer ${bearerToken}`
    });
    return obj;
}
async function findOrFetchConversation(tweetId, opts) {
    const { updateTime, state, debug } = opts;
    let { conversation } = state;
    if (!conversation) {
        const conversationId = await findOrFetchConversationId(tweetId, opts);
        state.conversationId = conversationId;
        const url = new URL('https://api.twitter.com/2/tweets/search/recent');
        url.searchParams.set('query', `conversation_id:${conversationId}`);
        url.searchParams.set('expansions', `referenced_tweets.id,author_id`);
        url.searchParams.set('tweet.fields', `author_id,lang,created_at`);
        url.searchParams.set('user.fields', `id,name,username,profile_image_url`);
        url.searchParams.set('max_results', `100`);
        const tweets = {};
        const users = {};
        let nextToken;
        let i = 0;
        while(++i){
            if (nextToken) {
                url.searchParams.set('next_token', nextToken);
            } else {
                url.searchParams.delete('next_token');
            }
            const obj = await findOrFetchTwitter(url.toString(), updateTime, opts);
            if (debug) console.log(`findOrFetchConversation nextToken=${nextToken}`, JSON.stringify(obj, undefined, 2));
            for (const tweetObj of obj.data){
                const tweet = tweetObj;
                tweets[tweet.id] = tweet;
            }
            if (obj.includes && Array.isArray(obj.includes.users)) {
                for (const userObj of obj.includes.users){
                    const user = userObj;
                    users[user.id] = user;
                }
            }
            if (obj.meta && typeof obj.meta.next_token === 'string') {
                nextToken = obj.meta.next_token;
                if (i === 50) break;
            } else {
                break;
            }
        }
        conversation = {
            tweets,
            users
        };
        state.conversation = conversation;
    }
    return conversation;
}
async function findOrFetchConversationId(tweetId, opts) {
    const { updateTime, state, debug } = opts;
    let { conversationId } = state;
    if (typeof conversationId === 'string') return conversationId;
    const url = new URL(`https://api.twitter.com/2/tweets/${tweetId}`);
    url.searchParams.set('tweet.fields', 'conversation_id');
    const obj = await findOrFetchTwitter(url.toString(), updateTime, opts);
    if (debug) console.log('findOrFetchConversation', JSON.stringify(obj, undefined, 2));
    conversationId = obj.data.conversation_id;
    if (typeof conversationId !== 'string') throw new Error(`Unexpected conversationId in payload: ${JSON.stringify(obj, undefined, 2)}`);
    state.conversationId = conversationId;
    return conversationId;
}
async function makeThreadcap(url, opts) {
    const { cache, updateTime, userAgent, protocol, bearerToken, debug } = opts;
    const fetcher = makeFetcherWithUserAgent(opts.fetcher, userAgent);
    const implementation = computeProtocolImplementation(protocol);
    return await implementation.initThreadcap(url, {
        fetcher,
        cache,
        updateTime,
        bearerToken,
        debug
    });
}
async function updateThreadcap(threadcap, opts) {
    const { userAgent, cache, updateTime, callbacks, maxLevels, maxNodes: maxNodesInput, startNode, keepGoing, bearerToken, debug } = opts;
    const fetcher = makeFetcherWithUserAgent(opts.fetcher, userAgent);
    const maxLevel = Math.min(Math.max(maxLevels === undefined ? 1000 : Math.round(maxLevels), 0), 1000);
    const maxNodes = maxNodesInput === undefined ? undefined : Math.max(Math.round(maxNodesInput), 0);
    if (startNode && !threadcap.nodes[startNode]) throw new Error(`Invalid start node: ${startNode}`);
    if (maxLevel === 0) return;
    if (maxNodes === 0) return;
    const implementation = computeProtocolImplementation(threadcap.protocol);
    const state = {};
    const idsBylevel = [
        startNode ? [
            startNode
        ] : [
            ...threadcap.roots
        ]
    ];
    let remaining = 1;
    let processed = 0;
    const processLevel = async (level)=>{
        callbacks?.onEvent({
            kind: 'process-level',
            phase: 'before',
            level: level + 1
        });
        const nextLevel = level + 1;
        for (const id of idsBylevel[level] || []){
            const processReplies = nextLevel < maxLevel;
            const node = await processNode(id, processReplies, threadcap, implementation, {
                updateTime,
                callbacks,
                state,
                fetcher,
                cache,
                bearerToken,
                debug
            });
            remaining--;
            processed++;
            if (maxNodes && processed >= maxNodes) return;
            if (keepGoing && !keepGoing()) return;
            if (node.replies && nextLevel < maxLevel) {
                if (!idsBylevel[nextLevel]) idsBylevel[nextLevel] = [];
                idsBylevel[nextLevel].push(...node.replies);
                remaining += node.replies.length;
            }
            callbacks?.onEvent({
                kind: 'nodes-remaining',
                remaining
            });
        }
        callbacks?.onEvent({
            kind: 'process-level',
            phase: 'after',
            level: level + 1
        });
        if (idsBylevel[nextLevel]) await processLevel(nextLevel);
    };
    await processLevel(0);
}
class InMemoryCache {
    map = new Map();
    onReturningCachedResponse;
    get(id, after) {
        const { response, fetched } = this.map.get(id) || {};
        if (response && fetched && fetched > after) {
            if (this.onReturningCachedResponse) this.onReturningCachedResponse(id, after, fetched, response);
            return Promise.resolve(response);
        }
        return Promise.resolve(undefined);
    }
    put(id, fetched, response) {
        this.map.set(id, {
            response,
            fetched
        });
        return Promise.resolve();
    }
}
function computeDefaultMillisToWait(input) {
    const { remaining, millisTillReset } = input;
    if (remaining >= 100) return 0;
    return remaining > 0 ? Math.round(millisTillReset / remaining) : millisTillReset;
}
function makeRateLimitedFetcher(fetcher, opts = {}) {
    const { callbacks } = opts;
    const computeMillisToWait = opts.computeMillisToWait || computeDefaultMillisToWait;
    const endpointLimits = new Map();
    return async (url, opts)=>{
        const { hostname, pathname } = new URL(url);
        const twitterEndpoint = computeTwitterEndpoint(hostname, pathname);
        const endpoint = twitterEndpoint || hostname;
        const limits = endpointLimits.get(endpoint);
        if (limits) {
            const { limit, remaining, reset } = limits;
            const millisTillReset = new Date(reset).getTime() - Date.now();
            const millisToWait = computeMillisToWait({
                endpoint,
                limit,
                remaining,
                reset,
                millisTillReset
            });
            if (millisToWait > 0) {
                callbacks?.onEvent({
                    kind: 'waiting-for-rate-limit',
                    endpoint,
                    millisToWait,
                    millisTillReset,
                    limit,
                    remaining,
                    reset
                });
                await sleep(millisToWait);
            }
        }
        const res = await fetcher(url, opts);
        const limitHeader = twitterEndpoint ? 'x-rate-limit-limit' : 'x-ratelimit-limit';
        const remainingHeader = twitterEndpoint ? 'x-rate-limit-remaining' : 'x-ratelimit-remaining';
        const resetHeader = twitterEndpoint ? 'x-rate-limit-reset' : 'x-ratelimit-reset';
        const limit = tryParseInt(res.headers.get(limitHeader) || '');
        const remaining = tryParseInt(res.headers.get(remainingHeader) || '');
        const resetStr = res.headers.get(resetHeader) || '';
        const reset = twitterEndpoint ? tryParseEpochSecondsAsIso8601(resetStr) : tryParseIso8601(resetStr);
        if (limit !== undefined && remaining !== undefined && reset !== undefined) {
            endpointLimits.set(endpoint, {
                limit,
                remaining,
                reset
            });
        }
        return res;
    };
}
function computeTwitterEndpoint(hostname, pathname) {
    if (hostname === 'api.twitter.com') {
        return pathname.replaceAll(/\d{4,}/g, ':id');
    }
}
function makeFetcherWithUserAgent(fetcher, userAgent) {
    userAgent = userAgent.trim();
    if (userAgent.length === 0) throw new Error(`Expected non-blank user-agent`);
    return async (url, opts)=>{
        const headers = {
            ...opts?.headers || {},
            'user-agent': userAgent
        };
        return await fetcher(url, {
            headers
        });
    };
}
function computeProtocolImplementation(protocol) {
    if (protocol === undefined || protocol === 'activitypub') return ActivityPubProtocolImplementation;
    if (protocol === 'twitter') return TwitterProtocolImplementation;
    if (protocol === 'bluesky') return BlueskyProtocolImplementation;
    if (protocol === 'nostr') return NostrProtocolImplementation;
    throw new Error(`Unsupported protocol: ${protocol}`);
}
async function processNode(id, processReplies, threadcap, implementation, opts) {
    const { updateTime, callbacks } = opts;
    let node = threadcap.nodes[id];
    if (!node) {
        node = {};
        threadcap.nodes[id] = node;
    }
    const updateComment = !node.commentAsof || node.commentAsof < updateTime;
    const existingCommenter = node.comment ? threadcap.commenters[node.comment.attributedTo] : undefined;
    const updateCommenter = !existingCommenter || existingCommenter.asof < updateTime;
    if (updateComment || updateCommenter) {
        try {
            if (updateComment) {
                node.comment = await implementation.fetchComment(id, opts);
            }
            const { attributedTo } = node.comment;
            const existingCommenter = threadcap.commenters[attributedTo];
            if (!existingCommenter || existingCommenter.asof < updateTime) {
                threadcap.commenters[attributedTo] = await implementation.fetchCommenter(attributedTo, opts);
            }
            node.commentError = undefined;
        } catch (e) {
            node.comment = undefined;
            node.commentError = `${e.stack || e}`;
        }
        node.commentAsof = updateTime;
    }
    callbacks?.onEvent({
        kind: 'node-processed',
        nodeId: id,
        part: 'comment',
        updated: updateComment
    });
    if (processReplies) {
        const updateReplies = !node.repliesAsof || node.repliesAsof < updateTime;
        if (updateReplies) {
            try {
                node.replies = await implementation.fetchReplies(id, opts);
                node.repliesError = undefined;
            } catch (e) {
                node.replies = undefined;
                node.repliesError = `${e.stack || e}`;
            }
            node.repliesAsof = updateTime;
        }
        callbacks?.onEvent({
            kind: 'node-processed',
            nodeId: id,
            part: 'replies',
            updated: updateReplies
        });
    }
    return node;
}
function sleep(ms) {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
function tryParseInt(value) {
    try {
        return parseInt(value);
    } catch  {
        return undefined;
    }
}
function tryParseIso8601(value) {
    return isValidIso8601(value) ? value : undefined;
}
function tryParseEpochSecondsAsIso8601(value) {
    const seconds = tryParseInt(value);
    return seconds && seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined;
}
class ValidationJobVM {
    fetchers;
    piSearchFetcher;
    threadcapUserAgent;
    nextJobId = 1;
    currentJob;
    get validating() {
        return this.currentJob !== undefined && !this.currentJob.done;
    }
    get done() {
        return this.currentJob !== undefined && this.currentJob.done;
    }
    get messages() {
        return this.currentJob ? this.currentJob.messages : [];
    }
    get isSearch() {
        return this.currentJob !== undefined && this.currentJob.search;
    }
    get searchResults() {
        return this.currentJob ? this.currentJob.searchResults : [];
    }
    get xml() {
        return this.currentJob?.xml;
    }
    get xmlSummaryText() {
        return this.currentJob?.xmlSummaryText;
    }
    get commentsResults() {
        return this.currentJob?.commentsResults;
    }
    constructor(opts){
        const { localFetcher, remoteFetcher, piSearchFetcher, threadcapUserAgent } = opts;
        this.fetchers = {
            localFetcher,
            remoteFetcher
        };
        this.piSearchFetcher = piSearchFetcher;
        this.threadcapUserAgent = threadcapUserAgent;
    }
    onChange = ()=>{};
    continueWith(url) {
        const { currentJob } = this;
        if (currentJob) {
            currentJob.done = false;
            currentJob.search = false;
            currentJob.searchResults.splice(0);
            currentJob.messages[0] = {
                type: 'running',
                text: 'Validating'
            };
            currentJob.messages.push({
                type: 'info',
                text: 'Continuing with feed from search',
                url
            });
            this.onChange();
            this.validateAsync(url, currentJob);
        }
    }
    startValidation(input, options) {
        const job = {
            id: this.nextJobId++,
            messages: [],
            searchResults: [],
            times: {},
            options,
            search: false,
            done: false,
            cancelled: false
        };
        this.currentJob = job;
        job.messages.push({
            type: 'running',
            text: 'Validating'
        });
        this.onChange();
        this.validateAsync(input, job);
    }
    cancelValidation() {
        if (this.currentJob && !this.currentJob.done) {
            this.currentJob.cancelled = true;
            this.currentJob.done = true;
            this.onChange();
        }
    }
    async fetch(url, opts) {
        const { headers } = opts;
        const { fetchers } = this;
        return await localOrRemoteFetch(url, {
            fetchers,
            headers
        });
    }
    async validateAsync(input, job) {
        input = normalizeInput(input);
        const { messages } = job;
        const setStatus = (text, opts = {})=>{
            const { url, type } = opts;
            messages[0] = {
                type: type || messages[0].type,
                text,
                url
            };
            this.onChange();
        };
        const addMessage = (type, text, opts = {})=>{
            const { url, tag, comment, reference } = opts;
            messages.push({
                type,
                text,
                tag,
                url,
                comment,
                reference
            });
            this.onChange();
        };
        const activityPubs = [];
        let twitter;
        let bluesky;
        let nostr;
        const headers = {
            'Accept-Encoding': 'gzip',
            'User-Agent': job.options.userAgent,
            'Cache-Control': 'no-store'
        };
        let continueWithUrl;
        const jobStart = Date.now();
        const { fetchers, piSearchFetcher } = this;
        try {
            input = input.trim();
            if (input === '') throw new Error(`No input`);
            if (input.startsWith('https://t.co/')) {
                const tcoHeaders = {
                    ...headers
                };
                delete tcoHeaders['User-Agent'];
                const { response } = await localOrRemoteFetch(input, {
                    fetchers,
                    headers: tcoHeaders,
                    useSide: 'remote'
                });
                if (job.done) return;
                if (response.status === 200) {
                    const xResponseUrl = response.headers.get('x-response-url');
                    if (xResponseUrl) {
                        input = xResponseUrl;
                        input = normalizeInput(input);
                    }
                }
            } else if (/^(https?|file|nostr):\/\/.+/i.test(input)) {
                const inputUrl = tryParseUrl1(input);
                if (!inputUrl) throw new Error(`Bad url: ${input}`);
                checkMatches('inputUrl.protocol', inputUrl.protocol, /^(https?|file|nostr):$/);
                let contentType;
                let response;
                if (inputUrl.protocol === 'nostr:') {
                    nostr = {
                        url: input,
                        subject: 'input url'
                    };
                } else {
                    if (inputUrl.protocol !== 'file:' && inputUrl.hostname !== 'feed.podbean.com') {
                        inputUrl.searchParams.set('_t', Date.now().toString());
                    }
                    if (inputUrl.hostname === 'reason.fm' || inputUrl.hostname === 'podvine.com') {
                        delete headers['User-Agent'];
                    }
                    const { response: r, side, fetchTime } = await localOrRemoteFetch(inputUrl.toString(), {
                        fetchers,
                        headers
                    });
                    if (job.done) return;
                    job.times.fetchTime = fetchTime;
                    if (side === 'local') {
                        if (inputUrl.protocol === 'file:') {
                            addMessage('good', `Local file contents loaded`);
                        } else {
                            addMessage('good', `Local fetch succeeded (CORS enabled)`, {
                                url: input
                            });
                        }
                    }
                    checkEqual1(`${inputUrl.host} response status`, r.status, 200);
                    contentType = r.headers.get('Content-Type') ?? undefined;
                    response = r;
                }
                let validateFeed = true;
                if (response && contentType && contentType.includes('/html')) {
                    if (inputUrl.hostname.endsWith('twitter.com')) {
                        addMessage('info', 'Found html, will try again as Twitter');
                        validateFeed = false;
                        twitter = {
                            url: input,
                            subject: 'input url'
                        };
                    } else if (inputUrl.hostname.endsWith('bsky.app')) {
                        addMessage('info', 'Found html, will try again as Bluesky');
                        validateFeed = false;
                        bluesky = {
                            url: input,
                            subject: 'input url'
                        };
                    } else {
                        addMessage('info', 'Found html, will try again as ActivityPub');
                        validateFeed = false;
                        let url = input;
                        if (inputUrl.hostname.endsWith('threads.net')) {
                            const html = await response.text();
                            const apUrl = /<link rel="alternate" href="(https:\/\/(www\.)?threads\.net\/ap\/[^"]+)" type="application\/activity\+json" \/>/.exec(html)?.at(1);
                            addMessage('info', `apUrl: ${apUrl}`);
                            url = apUrl ?? url;
                        }
                        activityPubs.push({
                            url,
                            subject: 'input url'
                        });
                    }
                }
                if (response && contentType && contentType.startsWith('application/activity+json')) {
                    addMessage('info', 'Found ActivityPub json');
                    const obj = await response.json();
                    validateFeed = false;
                    activityPubs.push({
                        url: input,
                        subject: 'input url',
                        obj
                    });
                }
                if (response && validateFeed) {
                    let start = Date.now();
                    const text = await response.text();
                    if (job.done) return;
                    job.times.readTime = Date.now() - start;
                    start = Date.now();
                    let xml;
                    try {
                        const result = validateXml(text);
                        if (result !== true) {
                            const { code, col, line, msg } = result;
                            throw new Error(`${code} (at line ${line}, col ${col}): ${msg}`);
                        }
                        xml = parseXml(text);
                        console.log(xml);
                    } catch (e) {
                        console.error(e);
                        const message = typeof e.message === 'string' ? e.message : '';
                        const knownInvalid = message === `Cannot read properties of undefined (reading 'parent')`;
                        addMessage('error', `Xml parse failed: ${knownInvalid ? 'Invalid xml' : e.message}`);
                    } finally{
                        job.times.parseTime = Date.now() - start;
                    }
                    if (xml) {
                        start = Date.now();
                        const onMessage = (type, node, message, opts)=>{
                            addMessage(type, message, opts);
                            if (opts?.tag === 'social-interact') {
                                const attributes = computeAttributeMap(node.attrsMap);
                                const uri = attributes.get('uri') || node.val;
                                if (uri) {
                                    if (attributes.get('platform')?.toLowerCase() === 'activitypub' || attributes.get('protocol')?.toLowerCase() === 'activitypub') {
                                        const episodeTitle = findEpisodeTitle(node);
                                        activityPubs.push({
                                            url: uri,
                                            subject: episodeTitle ? `“${episodeTitle}”` : 'episode'
                                        });
                                    }
                                    if (attributes.get('protocol')?.toLowerCase() === 'twitter') {
                                        const episodeTitle = findEpisodeTitle(node);
                                        twitter = {
                                            url: uri,
                                            subject: episodeTitle ? `“${episodeTitle}”` : 'episode'
                                        };
                                    }
                                    if (attributes.get('protocol')?.toLowerCase() === 'bluesky') {
                                        const episodeTitle = findEpisodeTitle(node);
                                        bluesky = {
                                            url: uri,
                                            subject: episodeTitle ? `“${episodeTitle}”` : 'episode'
                                        };
                                    }
                                }
                            }
                        };
                        const knownPiTags = new Set();
                        const unknownPiTags = new Set();
                        const piNamespaceUris = new Set();
                        let rssItemInfo;
                        let piLiveItemsCount = 0;
                        const callbacks = {
                            onGood: (node, message, opts)=>{
                                console.info(message);
                                onMessage('good', node, message, opts);
                            },
                            onError: (node, message, opts)=>{
                                console.error(message);
                                onMessage('error', node, message, opts);
                            },
                            onWarning: (node, message, opts)=>{
                                console.warn(message);
                                onMessage('warning', node, message, opts);
                            },
                            onInfo: (node, message, opts)=>{
                                console.info(message);
                                onMessage('info', node, message, opts);
                            },
                            onPodcastIndexTagNamesFound: (known, unknown, namespaceUris)=>{
                                known.forEach((v)=>knownPiTags.add(v));
                                unknown.forEach((v)=>unknownPiTags.add(v));
                                namespaceUris.forEach((v)=>piNamespaceUris.add(v));
                            },
                            onRssItemsFound: (itemsCount, itemsWithEnclosuresCount)=>{
                                rssItemInfo = {
                                    itemsCount,
                                    itemsWithEnclosuresCount
                                };
                            },
                            onPodcastIndexLiveItemsFound: (liveItemsCount)=>{
                                piLiveItemsCount = liveItemsCount;
                            }
                        };
                        let xmlSummaryText = 'Xml structure';
                        validateFeedXml(xml, callbacks);
                        job.times.validateTime = Date.now() - start;
                        if (rssItemInfo) {
                            const { itemsCount, itemsWithEnclosuresCount } = rssItemInfo;
                            const itemsWithoutEnclosuresCount = itemsCount - itemsWithEnclosuresCount;
                            const pieces = [
                                `Found ${unitString(itemsWithEnclosuresCount, 'episode')}`
                            ];
                            if (itemsWithoutEnclosuresCount > 0) pieces.push(`and ${unitString(itemsWithoutEnclosuresCount, 'item')} without enclosures`);
                            if (piLiveItemsCount > 0) pieces.push(`and ${unitString(piLiveItemsCount, 'liveItem')}`);
                            pieces.push(`in a ${formatBytes(text.length)} feed`);
                            addMessage('info', pieces.join(' '));
                            xmlSummaryText = `${itemsWithEnclosuresCount > 1 ? 'Podcast feed' : 'Feed'} structure`;
                        }
                        const piReference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md');
                        const tagString = (set)=>[
                                ...set
                            ].sort().map((v)=>`<podcast:${v}>`).join(', ');
                        if (knownPiTags.size > 0) {
                            addMessage('good', `Found ${unitString(knownPiTags.size, 'podcast namespace tag')}: ${tagString(knownPiTags)}`, {
                                reference: piReference
                            });
                        }
                        if (unknownPiTags.size > 0) {
                            addMessage('warning', `Found ${unitString(unknownPiTags.size, 'unknown podcast namespace tag')}: ${tagString(unknownPiTags)}`, {
                                reference: piReference
                            });
                        }
                        const misspelledNamespaces = setIntersect(piNamespaceUris, new Set(Qnames.PodcastIndex.KNOWN_MISSPELLED_NAMESPACES));
                        if (misspelledNamespaces.size > 0) {
                            const reference = podcastIndexReference('https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#rss-namespace-extension-for-podcasting-tag-specification');
                            addMessage('warning', `Found ${unitString(misspelledNamespaces.size, 'misspelled podcast namespace uri')}: ${[
                                ...misspelledNamespaces
                            ].join(', ')}`, {
                                reference
                            });
                        }
                        if (xml && Object.keys(xml).length > 0) {
                            job.xml = xml;
                            job.xmlSummaryText = xmlSummaryText;
                            this.onChange();
                        }
                    }
                }
                const hasComments = activityPubs.length > 0 || twitter || bluesky || nostr;
                console.log({
                    hasComments
                });
                const validateComments = job.options.validateComments !== undefined ? job.options.validateComments : true;
                if (hasComments && !validateComments) {
                    addMessage('info', 'Comments validation disabled, not fetching comments');
                } else if (hasComments) {
                    const results = [];
                    for (const activityPub of activityPubs){
                        setStatus(`Validating ActivityPub for ${activityPub.subject}`, {
                            url: activityPub.url
                        });
                        addMessage('info', 'Fetching ActivityPub comments', {
                            url: activityPub.url
                        });
                        const keepGoing = ()=>!job.done;
                        const remoteOnlyOrigins = new Set();
                        const computeUseSide = (url)=>{
                            return remoteOnlyOrigins.has(new URL(url).origin) ? 'remote' : undefined;
                        };
                        let activityPubCalls = 0;
                        const fetchActivityPubOrMastodon = async (url, opts)=>{
                            const { headers } = opts || {};
                            const localOrRemoteFetchFunction = headers && headers.accept === 'application/json' ? localOrRemoteFetchJson : localOrRemoteFetchActivityPub;
                            let { response, side } = await localOrRemoteFetchFunction(url, fetchers, computeUseSide(url), 0);
                            let obj = await response.clone().json();
                            console.log(JSON.stringify(obj, undefined, 2));
                            if (url.includes('/api/v1/statuses') && typeof obj.uri === 'string') {
                                url = obj.uri;
                                const { response: response2, side: side2 } = await localOrRemoteFetchFunction(url, fetchers, computeUseSide(url), 0);
                                response = response2.clone();
                                obj = await response2.json();
                                side = side2;
                                console.log(JSON.stringify(obj, undefined, 2));
                            }
                            if (side === 'remote') {
                                const origin = new URL(url).origin;
                                if (!remoteOnlyOrigins.has(origin)) {
                                    addMessage('warning', `Local fetch failed (CORS disabled?)`, {
                                        url,
                                        tag: 'cors'
                                    });
                                    remoteOnlyOrigins.add(origin);
                                }
                            }
                            activityPubCalls++;
                            return response;
                        };
                        const start = Date.now();
                        const callbacks = {
                            onEvent: (event)=>{
                                if (event.kind === 'warning') {
                                    const { message, url } = event;
                                    addMessage('warning', message, {
                                        url
                                    });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [
                                        ...results,
                                        {
                                            threadcap,
                                            subject: activityPub.subject
                                        }
                                    ];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const fetcher = makeRateLimitedFetcher(fetchActivityPubOrMastodon, {
                            callbacks
                        });
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                        const threadcap = await makeThreadcap(activityPub.url, {
                            userAgent,
                            fetcher,
                            cache
                        });
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject: activityPub.subject
                            }
                        ];
                        this.onChange();
                        const updateTime = new Date().toISOString();
                        await updateThreadcap(threadcap, {
                            updateTime,
                            keepGoing,
                            userAgent,
                            fetcher,
                            cache,
                            callbacks
                        });
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter((v)=>v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}, made ${unitString(activityPubCalls, 'ActivityPub call')}`);
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject: activityPub.subject
                            }
                        ];
                        this.onChange();
                        results.push({
                            threadcap,
                            subject: activityPub.subject
                        });
                    }
                    if (twitter) {
                        setStatus(`Validating Twitter comments for ${twitter.subject}`, {
                            url: twitter.url
                        });
                        addMessage('info', 'Fetching Twitter comments', {
                            url: twitter.url
                        });
                        const keepGoing = ()=>!job.done;
                        let twitterCommentsCalls = 0;
                        const fetchTwitterComments = async (url)=>{
                            const { response } = await localOrRemoteFetchJson(url, fetchers, 'remote', 0);
                            twitterCommentsCalls++;
                            return response;
                        };
                        const start = Date.now();
                        const callbacks = {
                            onEvent: (event)=>{
                                if (event.kind === 'warning') {
                                    const { message, url } = event;
                                    addMessage('warning', message, {
                                        url
                                    });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [
                                        ...results,
                                        {
                                            threadcap,
                                            subject: twitter.subject
                                        }
                                    ];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const fetcher = makeRateLimitedFetcher(fetchTwitterComments, {
                            callbacks
                        });
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                        const threadcap = await makeThreadcap(twitter.url, {
                            userAgent,
                            fetcher,
                            cache,
                            protocol: 'twitter'
                        });
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject: twitter.subject
                            }
                        ];
                        this.onChange();
                        const updateTime = new Date().toISOString();
                        await updateThreadcap(threadcap, {
                            updateTime,
                            keepGoing,
                            userAgent,
                            fetcher,
                            cache,
                            callbacks
                        });
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter((v)=>v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}, made ${unitString(twitterCommentsCalls, 'Twitter Comments call')}`);
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject: twitter.subject
                            }
                        ];
                        this.onChange();
                        results.push({
                            threadcap,
                            subject: twitter.subject
                        });
                    }
                    if (bluesky) {
                        setStatus(`Validating Bluesky comments for ${bluesky.subject}`, {
                            url: bluesky.url
                        });
                        addMessage('info', 'Fetching Bluesky comments', {
                            url: bluesky.url
                        });
                        const keepGoing = ()=>!job.done;
                        let blueskyCommentsCalls = 0;
                        const fetchBlueskyComments = async (url)=>{
                            const { response } = await localOrRemoteFetchJson(url, fetchers, 'remote', 0);
                            blueskyCommentsCalls++;
                            return response;
                        };
                        const start = Date.now();
                        const callbacks = {
                            onEvent: (event)=>{
                                if (event.kind === 'warning') {
                                    const { message, url } = event;
                                    addMessage('warning', message, {
                                        url
                                    });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [
                                        ...results,
                                        {
                                            threadcap,
                                            subject: bluesky.subject
                                        }
                                    ];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const fetcher = makeRateLimitedFetcher(fetchBlueskyComments, {
                            callbacks
                        });
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                        const updateTime = new Date().toISOString();
                        const threadcap = await makeThreadcap(bluesky.url, {
                            userAgent,
                            fetcher,
                            cache,
                            updateTime,
                            protocol: 'bluesky'
                        });
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject: bluesky.subject
                            }
                        ];
                        this.onChange();
                        await updateThreadcap(threadcap, {
                            updateTime,
                            keepGoing,
                            userAgent,
                            fetcher,
                            cache,
                            callbacks
                        });
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter((v)=>v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}, made ${unitString(blueskyCommentsCalls, 'Bluesky Comments call')}`);
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject: bluesky.subject
                            }
                        ];
                        this.onChange();
                        results.push({
                            threadcap,
                            subject: bluesky.subject
                        });
                    }
                    if (nostr) {
                        const { subject } = nostr;
                        console.log({
                            inputUrl: inputUrl.toString()
                        });
                        setStatus(`Validating Nostr comments for ${subject}`, {
                            url: nostr.url
                        });
                        addMessage('info', 'Fetching Nostr comments', {
                            url: nostr.url
                        });
                        const keepGoing = ()=>!job.done;
                        const start = Date.now();
                        const callbacks = {
                            onEvent: (event)=>{
                                if (event.kind === 'warning') {
                                    const { message, url } = event;
                                    addMessage('warning', message, {
                                        url
                                    });
                                } else if (event.kind === 'node-processed') {
                                    job.commentsResults = [
                                        ...results,
                                        {
                                            threadcap,
                                            subject
                                        }
                                    ];
                                    this.onChange();
                                } else {
                                    console.log('callbacks.event', event);
                                }
                            }
                        };
                        const cache = new InMemoryCache();
                        const userAgent = this.threadcapUserAgent;
                        const updateTime = new Date().toISOString();
                        const fetcher = fetch;
                        console.log({
                            nostrUrl: nostr.url
                        });
                        const threadcap = await makeThreadcap(nostr.url, {
                            userAgent,
                            fetcher,
                            cache,
                            updateTime,
                            protocol: 'nostr'
                        });
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject
                            }
                        ];
                        this.onChange();
                        await updateThreadcap(threadcap, {
                            updateTime,
                            keepGoing,
                            userAgent,
                            fetcher,
                            cache,
                            callbacks
                        });
                        job.times.commentsTime = Date.now() - start;
                        addMessage('info', `Found ${unitString(Object.values(threadcap.nodes).filter((v)=>v.comment).length, 'comment')} and ${unitString(Object.keys(threadcap.commenters).length, 'participant')}`);
                        job.commentsResults = [
                            ...results,
                            {
                                threadcap,
                                subject
                            }
                        ];
                        this.onChange();
                        results.push({
                            threadcap,
                            subject
                        });
                    }
                }
            } else {
                job.search = true;
                setStatus('Searching');
                const searchResponse = await piSearchFetcher(input, headers);
                checkEqual1('searchResponse.status', searchResponse.status, 200);
                const searchResult = await searchResponse.json();
                if (searchResult.piSearchResult) {
                    if (typeof searchResult.piSearchResult === 'string') {
                        addMessage('error', searchResult.piSearchResult);
                    } else {
                        job.searchResults.push(...searchResult.piSearchResult.feeds.slice(0, 20));
                    }
                } else if (searchResult.piIdResult) {
                    if (typeof searchResult.piIdResult === 'string') {
                        addMessage('error', searchResult.piIdResult);
                    } else {
                        if (!isReadonlyArray(searchResult.piIdResult.feed)) {
                            continueWithUrl = searchResult.piIdResult.feed.url;
                        }
                    }
                } else if (searchResult.piGuidResult) {
                    if (typeof searchResult.piGuidResult === 'string') {
                        addMessage('error', searchResult.piGuidResult);
                    } else {
                        if (isStringRecord(searchResult.piGuidResult)) {
                            continueWithUrl = searchResult.piGuidResult.feed.url;
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
            addMessage('error', e.message);
        } finally{
            addMessage('info', `${job.search ? 'Search took' : 'Took'} ${formatTime(Date.now() - jobStart)}${computeJobTimesStringSuffix(job.times)}`);
            if (continueWithUrl) {
                this.continueWith(continueWithUrl);
            } else {
                job.done = true;
                const status = job.cancelled ? 'Cancelled' : job.search && job.searchResults.length === 0 ? 'Found no podcasts' : job.search && job.searchResults.length === 1 ? 'Found one podcast, select to continue' : job.search ? `Found ${job.searchResults.length} podcasts, select one to continue` : 'Done';
                setStatus(status, {
                    type: 'done'
                });
            }
        }
    }
}
function formatTime(millis) {
    if (millis < 1000) return `${millis}ms`;
    return `${Math.round(millis / 1000 * 100) / 100}s`;
}
function computeJobTimesStringSuffix(times) {
    const rt = [
        [
            'fetch',
            times.fetchTime
        ],
        [
            'read',
            times.readTime
        ],
        [
            'parse',
            times.parseTime
        ],
        [
            'validate',
            times.validateTime
        ],
        [
            'comments',
            times.commentsTime
        ]
    ].filter((v)=>v[1] !== undefined).map((v)=>`${v[0]}=${formatTime(v[1])}`).join(', ');
    return rt === '' ? '' : ` (${rt})`;
}
function formatBytes(bytes) {
    let amount = bytes;
    if (amount < 1024) return `${amount}-byte`;
    amount = amount / 1024;
    if (amount < 1024) return `${Math.round(amount * 100) / 100}kb`;
    amount = amount / 1024;
    return `${Math.round(amount * 100) / 100}mb`;
}
function unitString(amount, unit) {
    return `${amount === 0 ? 'no' : amount === 1 ? 'one' : new Intl.NumberFormat().format(amount)} ${unit}${amount === 1 ? '' : 's'}`;
}
function normalizeInput(input) {
    input = input.trim();
    const m = /^https:\/\/podcasts\.apple\.com\/.*?(id\d+)(\?.*)?$/.exec(input);
    if (m) return m[1];
    return input;
}
function tryParseUrl1(url) {
    try {
        return new URL(url);
    } catch  {
        return undefined;
    }
}
function sleep1(ms) {
    return new Promise((resolve)=>setTimeout(resolve, ms));
}
async function localOrRemoteFetchActivityPub(url, fetchers, useSide, sleepMillisBetweenCalls) {
    if (sleepMillisBetweenCalls > 0) await sleep1(sleepMillisBetweenCalls);
    const { response, side } = await localOrRemoteFetch(url, {
        fetchers,
        headers: {
            'Accept': 'application/activity+json'
        },
        useSide
    });
    checkEqual1('res.status', response.status, 200);
    console.log([
        ...response.headers
    ].map((v)=>v.join(': ')));
    const contentType = response.headers.get('Content-Type');
    if (!(contentType || '').includes('json')) {
        throw new Error('Found html, not ActivityPub');
    }
    return {
        response,
        side
    };
}
async function localOrRemoteFetchJson(url, fetchers, useSide, sleepMillisBetweenCalls) {
    if (sleepMillisBetweenCalls > 0) await sleep1(sleepMillisBetweenCalls);
    const { response, side } = await localOrRemoteFetch(url, {
        fetchers,
        headers: {
            'Accept': 'application/json'
        },
        useSide
    });
    if (response.status !== 200) throw new Error(`Unexpected status ${response.status}: ${await response.text()}`);
    console.log([
        ...response.headers
    ].map((v)=>v.join(': ')));
    const contentType = response.headers.get('Content-Type');
    if (!(contentType || '').includes('json')) {
        throw new Error('Found html, not json');
    }
    return {
        response,
        side
    };
}
async function localOrRemoteFetch(url, opts) {
    const { fetchers, headers, useSide } = opts;
    if (useSide !== 'remote') {
        try {
            console.log(`local fetch: ${url}`);
            const start = Date.now();
            const response = await fetchers.localFetcher(url, headers);
            if (response.status === 429) throw new Error(`429: ${await response.text()}`);
            return {
                fetchTime: Date.now() - start,
                side: 'local',
                response
            };
        } catch (e) {
            if (new URL(url).protocol === 'file:') throw e;
            console.log('Failed to local fetch, trying remote', e);
        }
    }
    console.log(`remote fetch: ${url} ${headers}`);
    const start = Date.now();
    const response = await fetchers.remoteFetcher(url, headers);
    return {
        fetchTime: Date.now() - start,
        side: 'remote',
        response
    };
}
function findEpisodeTitle(socialInteract) {
    const item = socialInteract.parent;
    if (item) {
        const title = item.child['title'];
        if (title.length > 0 && title[0].val) {
            const val = title[0].val.trim();
            if (val.length > 0) {
                return val;
            }
        }
    }
    return undefined;
}
function isOauthObtainTokenResponse(obj) {
    return isStringRecord(obj) && typeof obj.access_token === 'string' && typeof obj.token_type === 'string' && isOptionalString(obj.scope) && isOptionalNumber(obj.created_at) && isOptionalNumber(obj.expires_in) && isOptionalString(obj.refresh_token);
}
async function fetchJson(req, bodyVerifier, { allow202, fetcher = fetch } = {}) {
    const res = await fetcher(req);
    if (!(res.status === 200 || allow202 && res.status === 202)) throw new Error(`Unexpected response status: ${res.status}, expected 200${allow202 ? ' or 202' : ''}, body=${await res.text()}`);
    const contentType = res.headers.get('content-type') ?? undefined;
    if (!/json/i.test(contentType ?? '')) throw new Error(`Unexpected response content-type: ${contentType}, expected json, body=${await res.text()}`);
    const body = await res.json();
    if (!bodyVerifier(body)) throw new Error(`Unexpected body: ${JSON.stringify(body, undefined, 2)}`);
    return body;
}
async function statusesPublish(apiBase, accessToken, opts) {
    const { idempotencyKey, status, in_reply_to_id, visibility, media_ids } = opts;
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    const data = new FormData();
    data.set('status', status);
    if (in_reply_to_id) data.set('in_reply_to_id', in_reply_to_id);
    if (visibility) data.set('visibility', visibility);
    if (media_ids) media_ids.forEach((v)=>data.append('media_ids[]', v));
    return await fetchJson(new Request(`${apiBase}/api/v1/statuses`, {
        method: 'POST',
        body: data,
        headers
    }), isStatus);
}
function isStatus(obj) {
    return isStringRecord(obj) && typeof obj.id === 'string' && typeof obj.uri === 'string' && typeof obj.created_at === 'string' && typeof obj.content === 'string' && typeof obj.visibility === 'string' && (obj.url === undefined || typeof obj.url === 'string') && (obj.in_reply_to_id === undefined || obj.in_reply_to_id === null || typeof obj.in_reply_to_id === 'string');
}
class ValidatorAppVM {
    job;
    get validating() {
        return this.job.validating;
    }
    get messages() {
        return this.job.messages;
    }
    get isSearch() {
        return this.job.isSearch;
    }
    get searchResults() {
        return this.job.searchResults;
    }
    get xml() {
        return this.job.xml;
    }
    get xmlSummaryText() {
        return this.job.xmlSummaryText;
    }
    get commentsResults() {
        return this.job.commentsResults;
    }
    constructor(opts){
        this.job = new ValidationJobVM(opts);
        this.job.onChange = ()=>this.onChange();
    }
    onChange = ()=>{};
    start() {}
    continueWith(url) {
        this.job.continueWith(url);
    }
    startValidation(input, options) {
        this.job.startValidation(input, options);
    }
    cancelValidation() {
        this.job.cancelValidation();
    }
    isLoggedIn(origin) {
        const info = loadLoginInfo(origin);
        return info !== undefined && !computeExpired(info.tokenResponse);
    }
    acceptLogin(origin, tokenResponse) {
        checkEqual1('token_type', tokenResponse.token_type.toLowerCase(), 'bearer');
        checkTrue('created_at, expires_in', [
            tokenResponse.created_at,
            tokenResponse.expires_in
        ].join(', '), !computeExpired(tokenResponse));
        saveLoginInfo({
            origin,
            tokenResponse
        });
    }
    expireLogin(origin) {
        deleteLoginInfo(origin);
    }
    async sendReply(reply, replyToUrl) {
        reply = reply.trim();
        if (reply === '') throw new Error('Bad reply: <empty>');
        const { origin } = new URL(replyToUrl);
        const info = loadLoginInfo(origin);
        if (!info) throw new Error(`No login for ${origin}`);
        if (computeExpired(info.tokenResponse)) throw new Error(`Login expired for ${origin}`);
        console.log(`replyToUrl`, replyToUrl);
        const mastodonId = await computeMastodonIdForUrl(replyToUrl, async (url, headers)=>{
            const { response } = await this.job.fetch(url, {
                headers
            });
            return response;
        });
        console.log(`mastodonId`, mastodonId);
        const { url } = await statusesPublish(origin, info.tokenResponse.access_token, {
            status: reply,
            in_reply_to_id: mastodonId
        });
        return url;
    }
}
function computeExpired(tokenResponse) {
    return typeof tokenResponse.created_at === 'number' && typeof tokenResponse.expires_in === 'number' && (tokenResponse.created_at + tokenResponse.expires_in) * 1000 <= Date.now();
}
function computeLoginInfoLocalStorageKey(origin) {
    return `login:${origin}`;
}
function loadLoginInfo(origin) {
    const str = localStorage.getItem(computeLoginInfoLocalStorageKey(origin));
    const obj = typeof str === 'string' ? JSON.parse(str) : undefined;
    return isLoginInfo(obj) ? obj : undefined;
}
function saveLoginInfo(info) {
    const { origin } = info;
    localStorage.setItem(computeLoginInfoLocalStorageKey(origin), JSON.stringify(info));
}
function deleteLoginInfo(origin) {
    localStorage.removeItem(computeLoginInfoLocalStorageKey(origin));
}
async function computeMastodonIdForUrl(replyToUrl, fetcher) {
    const { pathname } = new URL(replyToUrl);
    const m = /^\/.*?\/(\d+)$/.exec(pathname);
    if (m) return m[1];
    if (/^.*?\/objects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(new URL(replyToUrl).pathname)) {
        const res = await fetcher(replyToUrl, {
            accept: 'text/html'
        });
        if (res.status !== 200) throw new Error(`Bad status ${res.status}, expected 200 for ${replyToUrl}`);
        const m2 = /^\/.*?\/([a-zA-Z0-9]+)$/.exec(new URL(res.url).pathname);
        if (m2) return m2[1];
    }
    throw new Error(`computeMastodonIdForUrl: unable to compute for ${replyToUrl}`);
}
function isLoginInfo(obj) {
    return isStringRecord(obj) && typeof obj.origin === 'string' && isOauthObtainTokenResponse(obj.tokenResponse);
}
const CIRCULAR_PROGRESS_CSS = css`
.pure-material-progress-circular {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    box-sizing: border-box;
    border: none;
    border-radius: 50%;
    padding: 0.25em;
    width: 3em;
    height: 3em;
    color: var(--pure-material-primary-rgb, rgb(33, 150, 243));
    background-color: transparent;
    font-size: 16px;
    overflow: hidden;
}

.pure-material-progress-circular::-webkit-progress-bar {
    background-color: transparent;
}

/* Indeterminate */
.pure-material-progress-circular:indeterminate {
    -webkit-mask-image: linear-gradient(transparent 50%, black 50%), linear-gradient(to right, transparent 50%, black 50%);
    mask-image: linear-gradient(transparent 50%, black 50%), linear-gradient(to right, transparent 50%, black 50%);
    animation: pure-material-progress-circular 6s infinite cubic-bezier(0.3, 0.6, 1, 1);
}

:-ms-lang(x), .pure-material-progress-circular:indeterminate {
    animation: none;
}

.pure-material-progress-circular:indeterminate::before,
.pure-material-progress-circular:indeterminate::-webkit-progress-value {
    content: "";
    display: block;
    box-sizing: border-box;
    margin-bottom: 0.25em;
    border: solid 0.25em transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    width: 100% !important;
    height: 100%;
    background-color: transparent;
    animation: pure-material-progress-circular-pseudo 0.75s infinite linear alternate;
}

.pure-material-progress-circular:indeterminate::-moz-progress-bar {
    box-sizing: border-box;
    border: solid 0.25em transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    width: 100%;
    height: 100%;
    background-color: transparent;
    animation: pure-material-progress-circular-pseudo 0.75s infinite linear alternate;
}

.pure-material-progress-circular:indeterminate::-ms-fill {
    animation-name: -ms-ring;
}

@keyframes pure-material-progress-circular {
    0% {
        transform: rotate(0deg);
    }
    12.5% {
        transform: rotate(180deg);
        animation-timing-function: linear;
    }
    25% {
        transform: rotate(630deg);
    }
    37.5% {
        transform: rotate(810deg);
        animation-timing-function: linear;
    }
    50% {
        transform: rotate(1260deg);
    }
    62.5% {
        transform: rotate(1440deg);
        animation-timing-function: linear;
    }
    75% {
        transform: rotate(1890deg);
    }
    87.5% {
        transform: rotate(2070deg);
        animation-timing-function: linear;
    }
    100% {
        transform: rotate(2520deg);
    }
}

@keyframes pure-material-progress-circular-pseudo {
    0% {
        transform: rotate(-30deg);
    }
    29.4% {
        border-left-color: transparent;
    }
    29.41% {
        border-left-color: currentColor;
    }
    64.7% {
        border-bottom-color: transparent;
    }
    64.71% {
        border-bottom-color: currentColor;
    }
    100% {
        border-left-color: currentColor;
        border-bottom-color: currentColor;
        transform: rotate(225deg);
    }
}
`;
const INFO_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;
const WARNING_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M12 5.99L19.53 19H4.47L12 5.99M2.74 18c-.77 1.33.19 3 1.73 3h15.06c1.54 0 2.5-1.67 1.73-3L13.73 4.99c-.77-1.33-2.69-1.33-3.46 0L2.74 18zM11 11v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zm0 5h2v2h-2z"/></svg>`;
const ERROR_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20.71 7.98L16.03 3.3c-.19-.19-.45-.3-.71-.3H8.68c-.26 0-.52.11-.7.29L3.29 7.98c-.18.18-.29.44-.29.7v6.63c0 .27.11.52.29.71l4.68 4.68c.19.19.45.3.71.3h6.63c.27 0 .52-.11.71-.29l4.68-4.68c.19-.19.29-.44.29-.71V8.68c.01-.26-.1-.52-.28-.7zM19 14.9L14.9 19H9.1L5 14.9V9.1L9.1 5h5.8L19 9.1v5.8z"/><circle cx="12" cy="16" r="1"/><path d="M12 7c-.55 0-1 .45-1 1v5c0 .55.45 1 1 1s1-.45 1-1V8c0-.55-.45-1-1-1z"/></svg>`;
const CHECK_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71L10 14.17l-1.88-1.88c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l2.59 2.59c.39.39 1.02.39 1.41 0L17.3 9.7c.39-.39.39-1.02 0-1.41-.39-.39-1.03-.39-1.42 0z"/></svg>`;
const CHECKLIST_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><g><rect fill="none" height="24" width="24"/></g><g><g><path d="M5,5h2v1c0,1.1,0.9,2,2,2h6c1.1,0,2-0.9,2-2V5h2v5h2V5c0-1.1-0.9-2-2-2h-4.18C14.4,1.84,13.3,1,12,1S9.6,1.84,9.18,3H5 C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h6v-2H5V5z M12,3c0.55,0,1,0.45,1,1s-0.45,1-1,1s-1-0.45-1-1S11.45,3,12,3z"/><path d="M21.75,12.25c-0.41-0.41-1.09-0.41-1.5,0L15.51,17l-2.26-2.25c-0.41-0.41-1.08-0.41-1.5,0l0,0c-0.41,0.41-0.41,1.09,0,1.5 l3.05,3.04c0.39,0.39,1.02,0.39,1.41,0l5.53-5.54C22.16,13.34,22.16,12.66,21.75,12.25z"/></g></g></svg>`;
const SQUARE_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><g><rect fill="none" height="24" width="24"/></g><g><g><path d="M3,3v18h18V3H3z M19,19H5V5h14V19z"/></g></g></svg>`;
const PERSON_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-1c0-2.66-5.33-4-8-4z"/></svg>`;
function externalizeAnchor(anchor) {
    anchor.target = '_blank';
    anchor.rel = 'noreferrer noopener nofollow';
}
const COMMENTS_HTML = html`
<details id="comments-details" open>
    <summary>Comments for <span id="comments-subject">subject</span></summary>
    <output id="comments"></output>
</details>
`;
const COMMENTS_CSS = css`

#comments-details {
    display: none;
    font-size: 0.75rem;
    color: ${unsafeCSS(Theme.textColorHex)};
    margin-bottom: 1rem;
    max-width: 100%;
    overflow: hidden;
}

.comment {
    display: flex;
    max-width: 80ch;
    line-height: 1.5;
}

.comment .icon {
    width: 3em;
    height: 3em;
    border-radius: 0.5em;
    margin: 0.75em 1em 1em 0;
}

.comment div.icon {
    display: flex;
    align-items: center;
    justify-content: center;
}

.comment div.icon svg {
    width: 24px;
    height: 24px;
}

.comment div.error.icon svg {
    fill: ${unsafeCSS(Theme.textColorErrorHex)};
}

.comment div.default.icon svg {
    fill: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

.comment .rhs {
    display: flex;
    flex-direction: column;
    margin: 0.75em 1em 0 0;
    flex-grow: 1;
}

.comment .header {
    display: flex;
    gap: 0.5em;
    align-items: baseline;
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

.comment .header .url {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

.comment .rhs p {
    margin-block-start: 0em;
    margin-block-end: 0em;
}

.comment img {
    max-width: 80ch;
    width: auto;
    height: auto;
}

details.error {
    color: ${unsafeCSS(Theme.textColorErrorHex)};
}

.reply fieldset {
    display: flex;
    flex-direction: column;
    border: solid 1px ${unsafeCSS(Theme.textColorSecondaryHex)};
} 

.reply textarea {
    width: 100%;
    color: ${unsafeCSS(Theme.textColorHex)};
    background-color: ${unsafeCSS(Theme.backgroundColorHex)};
    margin-top: 0.5rem;
}

.reply button {
    padding: 0.25rem 2rem;
    align-self: flex-end;
    margin: 0.5rem 0;
}

`;
function initComments(document1, vm) {
    const commentsDetails = document1.getElementById('comments-details');
    const commentsSubjectSpan = document1.getElementById('comments-subject');
    const commentsOutput = document1.getElementById('comments');
    return ()=>{
        const results = vm.commentsResults;
        commentsDetails.style.display = results ? 'block' : 'none';
        commentsSubjectSpan.textContent = results && results[0] ? results && results[0].subject : 'subject';
        if (results !== _renderedResults) {
            renderComments(results, commentsOutput, vm);
            _renderedResults = results;
        }
    };
}
let _renderedResults;
function renderComments(results, commentsOutput, vm) {
    while(commentsOutput.firstChild)commentsOutput.removeChild(commentsOutput.firstChild);
    if (results) {
        for (const result of results){
            for (const root of result.threadcap.roots){
                renderNode(root, result.threadcap, commentsOutput, 0, vm);
            }
        }
    }
}
function renderNode(nodeId, threadcap, containerElement, level, vm) {
    const node = threadcap.nodes[nodeId];
    if (!node) return;
    const { comment, commentError, repliesError } = node;
    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    if (level > 0) commentDiv.style.marginLeft = `${level * 4}em`;
    const commenter = comment ? threadcap.commenters[comment.attributedTo] : undefined;
    if (comment && commenter?.icon?.url) {
        const iconImg = document.createElement('img');
        iconImg.classList.add('icon');
        iconImg.src = commenter.icon.url;
        commentDiv.appendChild(iconImg);
    } else {
        const iconDiv = document.createElement('div');
        iconDiv.classList.add('icon', commentError ? 'error' : 'default');
        iconDiv.innerHTML = (commentError ? ERROR_ICON : PERSON_ICON).getHTML();
        commentDiv.appendChild(iconDiv);
    }
    const rhsDiv = document.createElement('div');
    rhsDiv.classList.add('rhs');
    const headerDiv = document.createElement('div');
    headerDiv.classList.add('header');
    if (comment) {
        const attributedToDiv = document.createElement('div');
        attributedToDiv.classList.add('attributed-to');
        if (commenter) {
            let name = commenter.name;
            if (commenter.fqUsername) name += ' ' + commenter.fqUsername;
            if (commenter.url) {
                const a = document.createElement('a');
                a.href = commenter.url || '#';
                a.target = '_blank';
                a.textContent = name;
                attributedToDiv.appendChild(a);
            } else {
                attributedToDiv.appendChild(document.createTextNode(name));
            }
        } else {
            attributedToDiv.appendChild(document.createTextNode(comment.attributedTo || '<unknown>'));
        }
        headerDiv.appendChild(attributedToDiv);
        const ageText = document.createTextNode(comment.published ? computeAge(new Date(comment.published)) : '');
        if (comment.url) {
            const ageAnchor = document.createElement('a');
            ageAnchor.classList.add('url');
            ageAnchor.href = comment.url;
            externalizeAnchor(ageAnchor);
            ageAnchor.appendChild(ageText);
            headerDiv.appendChild(ageAnchor);
        } else {
            headerDiv.appendChild(ageText);
        }
    } else if (commentError) {
        const nodeAnchor = document.createElement('a');
        nodeAnchor.href = nodeId;
        nodeAnchor.innerText = nodeId;
        externalizeAnchor(nodeAnchor);
        headerDiv.appendChild(nodeAnchor);
    }
    rhsDiv.appendChild(headerDiv);
    const renderError = (error)=>{
        const lines = error.split('\n');
        const summary = lines[0];
        const errorDetails = document.createElement('details');
        errorDetails.classList.add('error');
        const errorSummary = document.createElement('summary');
        errorSummary.textContent = summary;
        errorDetails.appendChild(errorSummary);
        errorDetails.append(document.createTextNode(lines.slice(1).join('\n')));
        rhsDiv.appendChild(errorDetails);
    };
    if (comment) {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = Object.values(comment.content)[0] + (comment.questionOptions ? `<ul>${comment.questionOptions.map((v)=>`<li>${encodeXml(v)}</li>`).join('')}</ul>` : '');
        contentDiv.querySelectorAll('a').forEach(externalizeAnchor);
        rhsDiv.appendChild(contentDiv);
        for (const attachment of comment.attachments){
            const attachmentDetails = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = `Attachment (${attachment.mediaType})`;
            attachmentDetails.appendChild(summary);
            const img = document.createElement('img');
            img.src = attachment.url;
            if (attachment.width && attachment.height) {
                img.width = attachment.width;
                img.height = attachment.height;
            }
            attachmentDetails.appendChild(img);
            rhsDiv.appendChild(attachmentDetails);
        }
        if (comment.url && threadcap.protocol === 'activitypub') {
            const replyToUrl = comment.url;
            const replyDiv = document.createElement('div');
            replyDiv.className = 'reply';
            const replyAnchor = document.createElement('a');
            replyAnchor.textContent = "Reply →";
            replyAnchor.href = '#';
            replyDiv.appendChild(replyAnchor);
            const replyFieldsetContainer = document.createElement('div');
            replyDiv.appendChild(replyFieldsetContainer);
            replyAnchor.onclick = (e)=>{
                e.preventDefault();
                toggleReplyBox(replyAnchor, replyFieldsetContainer, replyToUrl, vm);
            };
            rhsDiv.appendChild(replyDiv);
        }
    } else if (commentError) {
        renderError(commentError);
    }
    if (repliesError) {
        renderError(repliesError);
    }
    commentDiv.appendChild(rhsDiv);
    containerElement.appendChild(commentDiv);
    for (const reply of node.replies || []){
        renderNode(reply, threadcap, containerElement, level + 1, vm);
    }
}
function computeAge(date) {
    const millis = Date.now() - date.getTime();
    const seconds = millis / 1000;
    const minutes = seconds / 60;
    if (minutes < 60) return `${Math.max(Math.floor(minutes), 1)}m`;
    const hours = minutes / 60;
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = hours / 24;
    return `${Math.floor(days)}d`;
}
function toggleReplyBox(anchor, fieldsetContainer, replyToUrl, vm) {
    if (anchor.textContent?.startsWith('Reply')) {
        anchor.textContent = 'Cancel ⅹ';
        LitElement.render(REPLY_BOX, fieldsetContainer);
        const loginAnchor = fieldsetContainer.getElementsByTagName('a')[0];
        const textarea = fieldsetContainer.getElementsByTagName('textarea')[0];
        const button = fieldsetContainer.getElementsByTagName('button')[0];
        const output = fieldsetContainer.getElementsByTagName('output')[0];
        const outputAnchor = output.getElementsByTagName('a')[0];
        const origin = new URL(replyToUrl).origin;
        outputAnchor.textContent = origin;
        let sent = false;
        let newReplyUrl;
        const update = ()=>{
            const loggedIn = vm.isLoggedIn(origin);
            loginAnchor.textContent = loggedIn ? `Sign out of ${origin}` : `Sign in at ${origin}...`;
            loginAnchor.style.display = !sent ? 'block' : 'none';
            textarea.style.display = button.style.display = loggedIn && !sent ? 'block' : 'none';
            output.style.display = sent ? 'block' : 'none';
            outputAnchor.href = newReplyUrl || origin;
        };
        loginAnchor.onclick = (e)=>{
            e.preventDefault();
            const loggedIn = vm.isLoggedIn(origin);
            if (loggedIn) {
                vm.expireLogin(origin);
                update();
            } else {
                const w = globalThis.open(`/login?origin=${encodeURIComponent(origin)}`, 'login');
                if (w) {
                    globalThis.onmessage = (e)=>{
                        const { data } = e;
                        console.log('onmessage', data);
                        if (typeof data.origin === 'string' && isOauthObtainTokenResponse(data.tokenResponse)) {
                            vm.acceptLogin(data.origin, data.tokenResponse);
                            update();
                            w.close();
                        }
                    };
                }
            }
        };
        button.onclick = async (e)=>{
            e.preventDefault();
            newReplyUrl = await vm.sendReply(textarea.value.trim(), replyToUrl);
            sent = true;
            anchor.textContent = 'Close ⅹ';
            update();
        };
        update();
        textarea.focus();
    } else {
        LitElement.render(undefined, fieldsetContainer);
        anchor.textContent = "Reply →";
    }
}
const REPLY_BOX = html`
<fieldset>
    <legend>Reply</legend>
    <a href="#">Login to ...</a>
    <textarea type="text" name="content" rows="4" placeholder="Your reply..."></textarea>
    <button type="submit">Send</button>
    <output>Reply sent! It may take a while to appear here, but you can view it over at <a href="#" target="_blank" rel="noreferrer noopener nofollow">(origin)</a></output>
</fieldset>
`;
const FORM_HTML = html`
<header>${CHECKLIST_ICON}<h1>Livewire Podcast Validator <span id="version">v0.2</span></h1></header>
<form id="form">
    <input id="text-input" type="text" spellcheck="false" placeholder="Podcast feed url, ActivityPub url, Bluesky url, Apple Podcasts url, search text (or drop a local file onto the page)" autocomplete="url" required>
    <button id="submit" type="submit">Validate</button>
</form>
`;
const FORM_CSS = css`

header {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: ${unsafeCSS(Theme.textColorHex)};
    margin-bottom: 1rem;
    opacity: 0.75;
}

header h1 {
    margin: 0;
}

header svg {
    transform: scale(1.5);
    fill: currentColor;
}

#version {
    opacity: 0.25;
}

#form {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

/** ios resets */
@supports (-webkit-touch-callout: none) {
    input, textarea, button {
        -webkit-appearance: none;
        border-radius: 0;
    }

    button {
        border: solid 1px white;
    }

}

@media only screen and (max-width: 650px) {

    header {
        font-size: 66%;
        gap: 0.5rem;
    }

    header svg {
        transform: scale(1.0);
    }

    #form {
        flex-direction: column;
    }

}

@media only screen and (max-width: 500px) {

    #version {
        display: none;
    }

}

#text-input {
    font-size: 1rem;
    flex-grow: 1;
    padding: 0.5rem 0.5rem;
    background-color: inherit;
    border: solid 1px white;
    outline: none;
    color: ${unsafeCSS(Theme.textColorHex)};
}

#text-input:read-only {
    opacity: 0.5; 
}

input:-webkit-autofill, input:-webkit-autofill:focus {
    transition: background-color 600000s 0s, color 600000s 0s;
}

#form button {
    padding: 0.5rem 1rem;
    min-width: 8rem;
}

`;
function initForm(document1, vm, staticData, droppedFiles) {
    const form = document1.getElementById('form');
    const textInput = document1.getElementById('text-input');
    const submitButton = document1.getElementById('submit');
    const versionSpan = document1.getElementById('version');
    const version = [
        staticData.version,
        staticData.pushId
    ].map((v)=>(v || '').trim()).filter((v)=>v.length > 0).join('.');
    versionSpan.textContent = staticData.version ? `v${version}` : '';
    document1.ondragover = (e)=>e.preventDefault();
    document1.ondrop = async (e)=>{
        e.preventDefault();
        try {
            const { name, text } = await getDroppedFileContents(e);
            if (!vm.validating) {
                const fileUrl = `file://(dropped)/${name}`;
                droppedFiles.set(new URL(fileUrl).toString(), text);
                textInput.value = fileUrl;
                vm.startValidation(textInput.value, {
                    validateComments: false,
                    userAgent: navigator.userAgent
                });
            }
        } catch (e) {
            console.log('Error in getDroppedFileText', e);
        }
    };
    const { searchParams } = new URL(document1.URL);
    const validate = searchParams.get('validate') || undefined;
    const input = searchParams.get('input') || undefined;
    const nocomments = searchParams.has('nocomments');
    const startValidation = ()=>vm.startValidation(textInput.value, {
            validateComments: !nocomments,
            userAgent: navigator.userAgent
        });
    form.onsubmit = (e)=>{
        e.preventDefault();
        if (vm.validating) {
            vm.cancelValidation();
        } else {
            startValidation();
        }
    };
    if (validate) {
        textInput.value = validate;
        setTimeout(startValidation, 0);
    } else if (input) {
        textInput.value = input;
    }
    textInput.focus();
    return ()=>{
        const wasDisabled = textInput.disabled;
        textInput.disabled = vm.validating;
        textInput.readOnly = vm.validating;
        submitButton.textContent = vm.validating ? 'Cancel' : 'Validate';
        if (wasDisabled && !textInput.disabled) {
            textInput.focus();
        }
    };
}
async function getDroppedFileContents(event) {
    const files = [];
    if (event.dataTransfer) {
        if (event.dataTransfer.items) {
            for (const item of event.dataTransfer.items){
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file instanceof File) files.push(file);
                } else {
                    throw new Error('Bad item.kind: expected file, found ' + item.kind);
                }
            }
        } else {
            for (const file of event.dataTransfer.files){
                files.push(file);
            }
        }
    }
    if (files.length === 0) {
        throw new Error('Nothing to import');
    }
    if (files.length > 1) {
        throw new Error('Cannot import multiple files');
    }
    const text = await files[0].text();
    const name = files[0].name;
    return {
        name,
        text
    };
}
const MESSAGES_HTML = html`
<output id="messages"></output>
`;
const MESSAGES_CSS = css`

#messages {
    margin-bottom: 1rem;
    display: grid;
    grid-template-columns: 2rem auto;
    align-items: center;
    font-size: 0.75rem;
}

#messages > div, #messages > a {
    animation: fadeInAnimation 0.4s;
}

#messages svg {
    transform: scale(0.75);
    fill: currentColor;
}

#messages > div.info {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

#messages > div.good {
    color: #43a047;
}
#messages > div.warning {
    color: #e65100;
}

#messages > div.error {
    color: ${unsafeCSS(Theme.textColorErrorHex)};
}

#messages > div.running, #messages > div.done {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#messages .icon {
    grid-column: 1;
    width: 24px;
    height: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
}

#messages .message {
    grid-column: 2;
}

#messages .url {
    grid-column: 2;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
}

#messages progress {
    font-size: 0.35rem;
}

#messages .reference {
    display: inline-block;
    margin-left: 0.25rem;
}

`;
function initMessages(document1, vm) {
    const messagesOutput = document1.getElementById('messages');
    return ()=>{
        LitElement.render(MESSAGE_HTML(vm), messagesOutput);
    };
}
const MESSAGE_HTML = (vm)=>html`
    ${vm.messages.filter(filterDuplicates()).map((message)=>html`
        <div class="${message.type} icon">${icon(message.type)}</div>
        <div class="${message.type} message">${message.text}${REFERENCE_HTML(message.reference)}</div>
        ${ANCHOR_HTML(message.url)}`)}`;
const REFERENCE_HTML = (reference)=>reference ? html`<a class="reference" href=${reference.href} target="_blank" rel="noreferrer noopener nofollow">[${reference.ruleset}]</a>` : undefined;
const ANCHOR_HTML = (url)=>url ? html`<a href=${url} target="_blank" rel="noreferrer noopener nofollow" class="url">${url}</a>` : undefined;
function icon(type) {
    return type === 'running' ? html`<progress class="pure-material-progress-circular"></progress>` : type === 'done' ? CHECK_ICON : type === 'error' ? ERROR_ICON : type === 'warning' ? WARNING_ICON : type === 'good' ? CHECK_ICON : INFO_ICON;
}
function filterDuplicates() {
    const tagUrls = new Set();
    return (message)=>{
        const { tag, url } = message;
        if (tag && url) {
            const tagUrl = `${tag}|${url}`;
            if (tagUrls.has(tagUrl)) return false;
            tagUrls.add(tagUrl);
            return true;
        }
        return true;
    };
}
const SEARCH_RESULTS_HTML = html`
<output id="search-results"></output>
`;
const SEARCH_RESULTS_CSS = css`

#search-results {
    margin-bottom: 1rem;
    display: none;
}

#search-results > div {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.75rem;
    animation: fadeInAnimation 0.4s;
    margin-bottom: 0.75rem;
    cursor: pointer;
}

#search-results .icon, #search-results img {
    width: 1.5rem;
    height: 1.5rem;
}

#search-results .title {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#search-results .author {
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
}

`;
function initSearchResults(document1, vm) {
    const searchResultsOutput = document1.getElementById('search-results');
    return ()=>{
        LitElement.render(RESULTS_HTML(vm), searchResultsOutput);
        searchResultsOutput.style.display = vm.isSearch ? 'block' : 'none';
    };
}
const RESULTS_HTML = (vm)=>html`
    ${vm.searchResults.map((result)=>html`<div class="search-result" @click="${selectResult(vm, result.url)}"><div class="icon">${IMAGE_HTML(result.artwork)}</div><div class="title">${result.title}</div><div class="author">${result.author}</div></div>`)}`;
const IMAGE_HTML = (artwork)=>artwork ? html`<img src=${artwork}>` : SQUARE_ICON;
function selectResult(vm, url) {
    return ()=>vm.continueWith(url);
}
const XML_HTML = html`
<output id="xml"></output>
`;
const XML_CSS = css`
#xml {
    font-family: ${unsafeCSS(Theme.monospaceFontFamily)};
    font-size: 0.75rem;
    line-height: 1rem;
    color: ${unsafeCSS(Theme.textColorSecondaryHex)};
    overflow-wrap: break-word;
    line-height: 1.4;
}

#xml .root {
    font-family: ${unsafeCSS(Theme.sansSerifFontFamily)};
    color: ${unsafeCSS(Theme.textColorHex)};
    line-height: 2;
}

#xml .content {
    color: ${unsafeCSS(Theme.textColorHex)};
}

#xml .podcast {
    color: #ab47bc;
}

#xml .indent {
    margin-left: 0.75rem;
}

#xml .indent2 {
    margin-left: 1.5rem;
}

summary.empty { list-style: none; cursor: text; }
summary.empty::-webkit-details-marker { display: none; }

#xml audio {
    margin: 0.5rem 1rem;
}
`;
function initXml(document1, vm) {
    const xmlOutput = document1.getElementById('xml');
    return ()=>{
        const xml = vm.xml;
        if (xml !== _renderedXml) {
            renderXml(xml, xmlOutput, vm.xmlSummaryText);
            _renderedXml = xml;
        }
    };
}
let _renderedXml;
function renderXml(xml, xmlOutput, xmlSummaryText) {
    while(xmlOutput.firstChild)xmlOutput.removeChild(xmlOutput.firstChild);
    if (xml) renderNode1(xml, xmlOutput, 0, new Set(), undefined, xmlSummaryText);
}
function renderNode1(node, containerElement, level, context, itemNumber, xmlSummaryText) {
    const { atts } = node;
    const details = document.createElement('details');
    const text = node.val || '';
    details.open = !context.has('found-item') || text.length > 0;
    if (level > 0) details.classList.add('indent');
    const summary = document.createElement('summary');
    if (level === 0) {
        renderTextPieces(summary, xmlSummaryText || 'Xml');
        summary.classList.add('root');
    } else {
        const spanClass = Qnames.PodcastIndex.NAMESPACES.includes(node.qname.namespaceUri || '') ? 'podcast' : undefined;
        renderTextPieces(summary, '<', {
            text: node.tagname,
            spanClass
        }, ...[
            ...atts.entries()
        ].flatMap((v)=>[
                ` ${v[0]}="`,
                {
                    text: v[1],
                    spanClass: 'content'
                },
                '"'
            ]), '>', itemNumber ? ` #${itemNumber}` : '');
    }
    details.appendChild(summary);
    let childCount = 0;
    if (text.length > 0) {
        const div = document.createElement('div');
        div.classList.add('content');
        renderTextPieces(div, text);
        div.classList.add('indent2');
        details.appendChild(div);
        childCount++;
    }
    for (const [name, value] of Object.entries(node.child)){
        let itemNumber = 1;
        let itemsNotShown = 0;
        for (const child of value){
            if (name === 'item' && itemNumber > 20) {
                itemsNotShown++;
                continue;
            }
            renderNode1(child, details, level + 1, context, value.length > 1 ? itemNumber : undefined);
            childCount++;
            itemNumber++;
        }
        if (itemsNotShown > 0) {
            const fakeNode = {
                tagname: `...and ${new Intl.NumberFormat().format(itemsNotShown)} more items`,
                atts: new Map(),
                qname: {
                    name: ''
                },
                attrsMap: {},
                child: {}
            };
            renderNode1(fakeNode, details, level - 1, context, undefined);
        }
    }
    const audioUrl = node.tagname === 'enclosure' && atts.get('url') || node.qname.namespaceUri && qnamesInclude(Qnames.PodcastIndex.source, node.qname) && atts.get('uri') || qnameEq(node.qname, Qnames.MediaRss.content) && (atts.get('type') || '').startsWith('audio') && atts.get('url');
    if (audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = audioUrl;
        details.appendChild(audio);
        childCount++;
    }
    if (childCount === 0) summary.classList.add('empty', 'indent');
    containerElement.appendChild(details);
    if (node.tagname === 'item') context.add('found-item');
}
function renderTextPieces(element, ...pieces) {
    for (const piece of pieces){
        const text = typeof piece === 'string' ? piece : piece.text;
        const spanClass = typeof piece === 'object' ? piece.spanClass : undefined;
        if (/^https?:\/\/[^\s)]+$/.test(text)) {
            const a = document.createElement('a');
            a.href = text;
            externalizeAnchor(a);
            a.appendChild(document.createTextNode(text));
            element.appendChild(a);
        } else {
            const textNode = document.createTextNode(text);
            if (spanClass) {
                const span = document.createElement('span');
                span.classList.add(spanClass);
                span.appendChild(textNode);
                element.appendChild(span);
            } else {
                element.appendChild(textNode);
            }
        }
    }
}
const appModuleScript = document.getElementById('app-module-script');
function setAppState(appState) {
    appModuleScript.dataset.state = appState;
}
setAppState('starting');
const appCss = css`

a {
    color: ${unsafeCSS(Theme.primaryColor300Hex)};
    text-underline-offset: 0.2rem;
    text-decoration: none;
}

@media (hover: hover) {
    a:hover {
        text-decoration: underline;
    }
}

main {
    margin: 2rem;
    display: flex;
    flex-direction: column;
}

@keyframes fadeInAnimation {
    0% {
        opacity: 0;
    }
    100% {
        opacity: 1;
    }
}

summary {
    cursor: pointer;
}

`;
const appHtml = html`
<main>
${FORM_HTML}
${MESSAGES_HTML}
${SEARCH_RESULTS_HTML}
${COMMENTS_HTML}
${XML_HTML}
</main>
`;
function appendStylesheets(cssTexts) {
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.textContent = cssTexts.join('\n\n');
    document.head.appendChild(styleSheet);
}
appendStylesheets([
    appCss.cssText,
    FORM_CSS.cssText,
    MESSAGES_CSS.cssText,
    SEARCH_RESULTS_CSS.cssText,
    COMMENTS_CSS.cssText,
    XML_CSS.cssText,
    CIRCULAR_PROGRESS_CSS.cssText
]);
LitElement.render(appHtml, document.body);
function parseStaticData() {
    const script = document.getElementById('static-data-script');
    const data = JSON.parse(script.text);
    const version = typeof data.version === 'string' ? data.version : undefined;
    const flags = typeof data.flags === 'string' ? data.flags : undefined;
    const debug = typeof data.debug === 'object' ? data.debug : undefined;
    const pushId = typeof data.pushId === 'string' ? data.pushId : undefined;
    return {
        version,
        flags,
        debug,
        pushId
    };
}
const staticData = parseStaticData();
const droppedFiles = new Map();
const localFetcher = (url, headers)=>{
    const droppedFileText = droppedFiles.get(url);
    if (droppedFileText) return Promise.resolve(new Response(droppedFileText));
    if (new URL(url).protocol === 'file:') throw new Error('Unknown dropped file, try dropping it again');
    return fetch(url, {
        headers
    });
};
const remoteFetcher = (url, headers)=>fetch(`/f/${url.replaceAll(/[^a-zA-Z0-9.]+/g, '_')}`, {
        method: 'POST',
        body: JSON.stringify({
            url,
            headers
        })
    });
const piSearchFetcher = (input, headers)=>fetch(`/s`, {
        method: 'POST',
        body: JSON.stringify({
            input,
            headers
        })
    });
const threadcapUserAgent = navigator.userAgent;
const vm = new ValidatorAppVM({
    threadcapUserAgent,
    localFetcher,
    remoteFetcher,
    piSearchFetcher
});
const updateForm = initForm(document, vm, staticData, droppedFiles);
const updateMessages = initMessages(document, vm);
const updateSearchResults = initSearchResults(document, vm);
const updateComments = initComments(document, vm);
const updateXml = initXml(document, vm);
vm.onChange = ()=>{
    updateForm();
    updateMessages();
    updateSearchResults();
    updateComments();
    updateXml();
};
vm.start();
setAppState('started');

