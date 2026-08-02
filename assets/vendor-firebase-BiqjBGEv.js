const un=globalThis||void 0||self;function hd(n){return n&&n.__esModule&&Object.prototype.hasOwnProperty.call(n,"default")?n.default:n}var Iu={exports:{}},me=Iu.exports={},nt,rt;function Ks(){throw new Error("setTimeout has not been defined")}function Qs(){throw new Error("clearTimeout has not been defined")}(function(){try{typeof setTimeout=="function"?nt=setTimeout:nt=Ks}catch{nt=Ks}try{typeof clearTimeout=="function"?rt=clearTimeout:rt=Qs}catch{rt=Qs}})();function wu(n){if(nt===setTimeout)return setTimeout(n,0);if((nt===Ks||!nt)&&setTimeout)return nt=setTimeout,setTimeout(n,0);try{return nt(n,0)}catch{try{return nt.call(null,n,0)}catch{return nt.call(this,n,0)}}}function dd(n){if(rt===clearTimeout)return clearTimeout(n);if((rt===Qs||!rt)&&clearTimeout)return rt=clearTimeout,clearTimeout(n);try{return rt(n)}catch{try{return rt.call(null,n)}catch{return rt.call(this,n)}}}var gt=[],Mn=!1,rn,Ti=-1;function fd(){!Mn||!rn||(Mn=!1,rn.length?gt=rn.concat(gt):Ti=-1,gt.length&&vu())}function vu(){if(!Mn){var n=wu(fd);Mn=!0;for(var e=gt.length;e;){for(rn=gt,gt=[];++Ti<e;)rn&&rn[Ti].run();Ti=-1,e=gt.length}rn=null,Mn=!1,dd(n)}}me.nextTick=function(n){var e=new Array(arguments.length-1);if(arguments.length>1)for(var t=1;t<arguments.length;t++)e[t-1]=arguments[t];gt.push(new Au(n,e)),gt.length===1&&!Mn&&wu(vu)};function Au(n,e){this.fun=n,this.array=e}Au.prototype.run=function(){this.fun.apply(null,this.array)};me.title="browser";me.browser=!0;me.env={};me.argv=[];me.version="";me.versions={};function vt(){}me.on=vt;me.addListener=vt;me.once=vt;me.off=vt;me.removeListener=vt;me.removeAllListeners=vt;me.emit=vt;me.prependListener=vt;me.prependOnceListener=vt;me.listeners=function(n){return[]};me.binding=function(n){throw new Error("process.binding is not supported")};me.cwd=function(){return"/"};me.chdir=function(n){throw new Error("process.chdir is not supported")};me.umask=function(){return 0};var pd=Iu.exports;const md=hd(pd),gd=()=>{};var Za={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ru=function(n){const e=[];let t=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?e[t++]=i:i<2048?(e[t++]=i>>6|192,e[t++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),e[t++]=i>>18|240,e[t++]=i>>12&63|128,e[t++]=i>>6&63|128,e[t++]=i&63|128):(e[t++]=i>>12|224,e[t++]=i>>6&63|128,e[t++]=i&63|128)}return e},_d=function(n){const e=[];let t=0,r=0;for(;t<n.length;){const i=n[t++];if(i<128)e[r++]=String.fromCharCode(i);else if(i>191&&i<224){const o=n[t++];e[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){const o=n[t++],a=n[t++],h=n[t++],f=((i&7)<<18|(o&63)<<12|(a&63)<<6|h&63)-65536;e[r++]=String.fromCharCode(55296+(f>>10)),e[r++]=String.fromCharCode(56320+(f&1023))}else{const o=n[t++],a=n[t++];e[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|a&63)}}return e.join("")},Su={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,e){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const o=n[i],a=i+1<n.length,h=a?n[i+1]:0,f=i+2<n.length,m=f?n[i+2]:0,p=o>>2,w=(o&3)<<4|h>>4;let k=(h&15)<<2|m>>6,N=m&63;f||(N=64,a||(k=64)),r.push(t[p],t[w],t[k],t[N])}return r.join("")},encodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(n):this.encodeByteArray(Ru(n),e)},decodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(n):_d(this.decodeStringToByteArray(n,e))},decodeStringToByteArray(n,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const o=t[n.charAt(i++)],h=i<n.length?t[n.charAt(i)]:0;++i;const m=i<n.length?t[n.charAt(i)]:64;++i;const w=i<n.length?t[n.charAt(i)]:64;if(++i,o==null||h==null||m==null||w==null)throw new yd;const k=o<<2|h>>4;if(r.push(k),m!==64){const N=h<<4&240|m>>2;if(r.push(N),w!==64){const L=m<<6&192|w;r.push(L)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class yd extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Ed=function(n){const e=Ru(n);return Su.encodeByteArray(e,!0)},Vi=function(n){return Ed(n).replace(/\./g,"")},Pu=function(n){try{return Su.decodeString(n,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Td(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof un<"u")return un;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Id=()=>Td().__FIREBASE_DEFAULTS__,wd=()=>{if(typeof md>"u"||typeof Za>"u")return;const n=Za.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},vd=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=n&&Pu(n[1]);return e&&JSON.parse(e)},Ji=()=>{try{return gd()||Id()||wd()||vd()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Cu=n=>{var e,t;return(t=(e=Ji())==null?void 0:e.emulatorHosts)==null?void 0:t[n]},Ad=n=>{const e=Cu(n);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),r]:[e.substring(0,t),r]},bu=()=>{var n;return(n=Ji())==null?void 0:n.config},ku=n=>{var e;return(e=Ji())==null?void 0:e[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rd{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,r)=>{t?this.reject(t):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,r))}}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sd(n,e){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},r=e||"demo-project",i=n.iat||0,o=n.sub||n.user_id;if(!o)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const a={iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:o,user_id:o,firebase:{sign_in_provider:"custom",identities:{}},...n};return[Vi(JSON.stringify(t)),Vi(JSON.stringify(a)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ue(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Pd(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(Ue())}function Cd(){var e;const n=(e=Ji())==null?void 0:e.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(un.process)==="[object process]"}catch{return!1}}function bd(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function kd(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function Vd(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function Dd(){const n=Ue();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function Nd(){return!Cd()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function xd(){try{return typeof indexedDB=="object"}catch{return!1}}function Od(){return new Promise((n,e)=>{try{let t=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),t||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{t=!1},i.onerror=()=>{var o;e(((o=i.error)==null?void 0:o.message)||"")}}catch(t){e(t)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Md="FirebaseError";class At extends Error{constructor(e,t,r){super(t),this.code=e,this.customData=r,this.name=Md,Object.setPrototypeOf(this,At.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Fr.prototype.create)}}class Fr{constructor(e,t,r){this.service=e,this.serviceName=t,this.errors=r}create(e,...t){const r=t[0]||{},i=`${this.service}/${e}`,o=this.errors[e],a=o?Ld(o,r):"Error",h=`${this.serviceName}: ${a} (${i}).`;return new At(i,h,r)}}function Ld(n,e){return n.replace(Fd,(t,r)=>{const i=e[r];return i!=null?String(i):`<${r}?>`})}const Fd=/\{\$([^}]+)}/g;function Ud(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}function ln(n,e){if(n===e)return!0;const t=Object.keys(n),r=Object.keys(e);for(const i of t){if(!r.includes(i))return!1;const o=n[i],a=e[i];if(ec(o)&&ec(a)){if(!ln(o,a))return!1}else if(o!==a)return!1}for(const i of r)if(!t.includes(i))return!1;return!0}function ec(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ur(n){const e=[];for(const[t,r]of Object.entries(n))Array.isArray(r)?r.forEach(i=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(i))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function Bd(n,e){const t=new jd(n,e);return t.subscribe.bind(t)}class jd{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,r){let i;if(e===void 0&&t===void 0&&r===void 0)throw new Error("Missing Observer.");$d(e,["next","error","complete"])?i=e:i={next:e,error:t,complete:r},i.next===void 0&&(i.next=Os),i.error===void 0&&(i.error=Os),i.complete===void 0&&(i.complete=Os);const o=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?i.error(this.finalError):i.complete()}catch{}}),this.observers.push(i),o}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function $d(n,e){if(typeof n!="object"||n===null)return!1;for(const t of e)if(t in n&&typeof n[t]=="function")return!0;return!1}function Os(){}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function je(n){return n&&n._delegate?n._delegate:n}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Br(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Vu(n){return(await fetch(n,{credentials:"include"})).ok}class hn{constructor(e,t,r){this.name=e,this.instanceFactory=t,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nn="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qd{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const r=new Rd;if(this.instancesDeferred.set(t,r),this.isInitialized(t)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:t});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){const t=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),r=(e==null?void 0:e.optional)??!1;if(this.isInitialized(t)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:t})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(Hd(e))try{this.getOrInitializeService({instanceIdentifier:nn})}catch{}for(const[t,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(t);try{const o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(e=nn){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=nn){return this.instances.has(e)}getOptions(e=nn){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:t});for(const[o,a]of this.instancesDeferred.entries()){const h=this.normalizeInstanceIdentifier(o);r===h&&a.resolve(i)}return i}onInit(e,t){const r=this.normalizeInstanceIdentifier(t),i=this.onInitCallbacks.get(r)??new Set;i.add(e),this.onInitCallbacks.set(r,i);const o=this.instances.get(r);return o&&e(o,r),()=>{i.delete(e)}}invokeOnInitCallbacks(e,t){const r=this.onInitCallbacks.get(t);if(r)for(const i of r)try{i(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:zd(e),options:t}),this.instances.set(e,r),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=nn){return this.component?this.component.multipleInstances?e:nn:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function zd(n){return n===nn?void 0:n}function Hd(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gd{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new qd(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Q;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(Q||(Q={}));const Wd={debug:Q.DEBUG,verbose:Q.VERBOSE,info:Q.INFO,warn:Q.WARN,error:Q.ERROR,silent:Q.SILENT},Kd=Q.INFO,Qd={[Q.DEBUG]:"log",[Q.VERBOSE]:"log",[Q.INFO]:"info",[Q.WARN]:"warn",[Q.ERROR]:"error"},Jd=(n,e,...t)=>{if(e<n.logLevel)return;const r=new Date().toISOString(),i=Qd[e];if(i)console[i](`[${r}]  ${n.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Io{constructor(e){this.name=e,this._logLevel=Kd,this._logHandler=Jd,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in Q))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Wd[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,Q.DEBUG,...e),this._logHandler(this,Q.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,Q.VERBOSE,...e),this._logHandler(this,Q.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,Q.INFO,...e),this._logHandler(this,Q.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,Q.WARN,...e),this._logHandler(this,Q.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,Q.ERROR,...e),this._logHandler(this,Q.ERROR,...e)}}const Yd=(n,e)=>e.some(t=>n instanceof t);let tc,nc;function Xd(){return tc||(tc=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Zd(){return nc||(nc=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Du=new WeakMap,Js=new WeakMap,Nu=new WeakMap,Ms=new WeakMap,wo=new WeakMap;function ef(n){const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("success",o),n.removeEventListener("error",a)},o=()=>{t(Ft(n.result)),i()},a=()=>{r(n.error),i()};n.addEventListener("success",o),n.addEventListener("error",a)});return e.then(t=>{t instanceof IDBCursor&&Du.set(t,n)}).catch(()=>{}),wo.set(e,n),e}function tf(n){if(Js.has(n))return;const e=new Promise((t,r)=>{const i=()=>{n.removeEventListener("complete",o),n.removeEventListener("error",a),n.removeEventListener("abort",a)},o=()=>{t(),i()},a=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",o),n.addEventListener("error",a),n.addEventListener("abort",a)});Js.set(n,e)}let Ys={get(n,e,t){if(n instanceof IDBTransaction){if(e==="done")return Js.get(n);if(e==="objectStoreNames")return n.objectStoreNames||Nu.get(n);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return Ft(n[e])},set(n,e,t){return n[e]=t,!0},has(n,e){return n instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in n}};function nf(n){Ys=n(Ys)}function rf(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const r=n.call(Ls(this),e,...t);return Nu.set(r,e.sort?e.sort():[e]),Ft(r)}:Zd().includes(n)?function(...e){return n.apply(Ls(this),e),Ft(Du.get(this))}:function(...e){return Ft(n.apply(Ls(this),e))}}function sf(n){return typeof n=="function"?rf(n):(n instanceof IDBTransaction&&tf(n),Yd(n,Xd())?new Proxy(n,Ys):n)}function Ft(n){if(n instanceof IDBRequest)return ef(n);if(Ms.has(n))return Ms.get(n);const e=sf(n);return e!==n&&(Ms.set(n,e),wo.set(e,n)),e}const Ls=n=>wo.get(n);function of(n,e,{blocked:t,upgrade:r,blocking:i,terminated:o}={}){const a=indexedDB.open(n,e),h=Ft(a);return r&&a.addEventListener("upgradeneeded",f=>{r(Ft(a.result),f.oldVersion,f.newVersion,Ft(a.transaction),f)}),t&&a.addEventListener("blocked",f=>t(f.oldVersion,f.newVersion,f)),h.then(f=>{o&&f.addEventListener("close",()=>o()),i&&f.addEventListener("versionchange",m=>i(m.oldVersion,m.newVersion,m))}).catch(()=>{}),h}const af=["get","getKey","getAll","getAllKeys","count"],cf=["put","add","delete","clear"],Fs=new Map;function rc(n,e){if(!(n instanceof IDBDatabase&&!(e in n)&&typeof e=="string"))return;if(Fs.get(e))return Fs.get(e);const t=e.replace(/FromIndex$/,""),r=e!==t,i=cf.includes(t);if(!(t in(r?IDBIndex:IDBObjectStore).prototype)||!(i||af.includes(t)))return;const o=async function(a,...h){const f=this.transaction(a,i?"readwrite":"readonly");let m=f.store;return r&&(m=m.index(h.shift())),(await Promise.all([m[t](...h),i&&f.done]))[0]};return Fs.set(e,o),o}nf(n=>({...n,get:(e,t,r)=>rc(e,t)||n.get(e,t,r),has:(e,t)=>!!rc(e,t)||n.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uf{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(lf(t)){const r=t.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(t=>t).join(" ")}}function lf(n){const e=n.getComponent();return(e==null?void 0:e.type)==="VERSION"}const Xs="@firebase/app",ic="0.14.10";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Et=new Io("@firebase/app"),hf="@firebase/app-compat",df="@firebase/analytics-compat",ff="@firebase/analytics",pf="@firebase/app-check-compat",mf="@firebase/app-check",gf="@firebase/auth",_f="@firebase/auth-compat",yf="@firebase/database",Ef="@firebase/data-connect",Tf="@firebase/database-compat",If="@firebase/functions",wf="@firebase/functions-compat",vf="@firebase/installations",Af="@firebase/installations-compat",Rf="@firebase/messaging",Sf="@firebase/messaging-compat",Pf="@firebase/performance",Cf="@firebase/performance-compat",bf="@firebase/remote-config",kf="@firebase/remote-config-compat",Vf="@firebase/storage",Df="@firebase/storage-compat",Nf="@firebase/firestore",xf="@firebase/ai",Of="@firebase/firestore-compat",Mf="firebase",Lf="12.11.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zs="[DEFAULT]",Ff={[Xs]:"fire-core",[hf]:"fire-core-compat",[ff]:"fire-analytics",[df]:"fire-analytics-compat",[mf]:"fire-app-check",[pf]:"fire-app-check-compat",[gf]:"fire-auth",[_f]:"fire-auth-compat",[yf]:"fire-rtdb",[Ef]:"fire-data-connect",[Tf]:"fire-rtdb-compat",[If]:"fire-fn",[wf]:"fire-fn-compat",[vf]:"fire-iid",[Af]:"fire-iid-compat",[Rf]:"fire-fcm",[Sf]:"fire-fcm-compat",[Pf]:"fire-perf",[Cf]:"fire-perf-compat",[bf]:"fire-rc",[kf]:"fire-rc-compat",[Vf]:"fire-gcs",[Df]:"fire-gcs-compat",[Nf]:"fire-fst",[Of]:"fire-fst-compat",[xf]:"fire-vertex","fire-js":"fire-js",[Mf]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Di=new Map,Uf=new Map,eo=new Map;function sc(n,e){try{n.container.addComponent(e)}catch(t){Et.debug(`Component ${e.name} failed to register with FirebaseApp ${n.name}`,t)}}function $n(n){const e=n.name;if(eo.has(e))return Et.debug(`There were multiple attempts to register component ${e}.`),!1;eo.set(e,n);for(const t of Di.values())sc(t,n);for(const t of Uf.values())sc(t,n);return!0}function vo(n,e){const t=n.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),n.container.getProvider(e)}function Qe(n){return n==null?!1:n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Bf={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},Ut=new Fr("app","Firebase",Bf);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jf{constructor(e,t,r){this._isDeleted=!1,this._options={...e},this._config={...t},this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new hn("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw Ut.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qn=Lf;function $f(n,e={}){let t=n;typeof e!="object"&&(e={name:e});const r={name:Zs,automaticDataCollectionEnabled:!0,...e},i=r.name;if(typeof i!="string"||!i)throw Ut.create("bad-app-name",{appName:String(i)});if(t||(t=bu()),!t)throw Ut.create("no-options");const o=Di.get(i);if(o){if(ln(t,o.options)&&ln(r,o.config))return o;throw Ut.create("duplicate-app",{appName:i})}const a=new Gd(i);for(const f of eo.values())a.addComponent(f);const h=new jf(t,r,a);return Di.set(i,h),h}function xu(n=Zs){const e=Di.get(n);if(!e&&n===Zs&&bu())return $f();if(!e)throw Ut.create("no-app",{appName:n});return e}function Bt(n,e,t){let r=Ff[n]??n;t&&(r+=`-${t}`);const i=r.match(/\s|\//),o=e.match(/\s|\//);if(i||o){const a=[`Unable to register library "${r}" with version "${e}":`];i&&a.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&o&&a.push("and"),o&&a.push(`version name "${e}" contains illegal characters (whitespace or "/")`),Et.warn(a.join(" "));return}$n(new hn(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qf="firebase-heartbeat-database",zf=1,Pr="firebase-heartbeat-store";let Us=null;function Ou(){return Us||(Us=of(qf,zf,{upgrade:(n,e)=>{switch(e){case 0:try{n.createObjectStore(Pr)}catch(t){console.warn(t)}}}}).catch(n=>{throw Ut.create("idb-open",{originalErrorMessage:n.message})})),Us}async function Hf(n){try{const t=(await Ou()).transaction(Pr),r=await t.objectStore(Pr).get(Mu(n));return await t.done,r}catch(e){if(e instanceof At)Et.warn(e.message);else{const t=Ut.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});Et.warn(t.message)}}}async function oc(n,e){try{const r=(await Ou()).transaction(Pr,"readwrite");await r.objectStore(Pr).put(e,Mu(n)),await r.done}catch(t){if(t instanceof At)Et.warn(t.message);else{const r=Ut.create("idb-set",{originalErrorMessage:t==null?void 0:t.message});Et.warn(r.message)}}}function Mu(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gf=1024,Wf=30;class Kf{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new Jf(t),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,t;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=ac();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(a=>a.date===o))return;if(this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats.length>Wf){const a=Yf(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(a,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){Et.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=ac(),{heartbeatsToSend:r,unsentEntries:i}=Qf(this._heartbeatsCache.heartbeats),o=Vi(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=t,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(t){return Et.warn(t),""}}}function ac(){return new Date().toISOString().substring(0,10)}function Qf(n,e=Gf){const t=[];let r=n.slice();for(const i of n){const o=t.find(a=>a.agent===i.agent);if(o){if(o.dates.push(i.date),cc(t)>e){o.dates.pop();break}}else if(t.push({agent:i.agent,dates:[i.date]}),cc(t)>e){t.pop();break}r=r.slice(1)}return{heartbeatsToSend:t,unsentEntries:r}}class Jf{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return xd()?Od().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await Hf(this.app);return t!=null&&t.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return oc(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return oc(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}}function cc(n){return Vi(JSON.stringify({version:2,heartbeats:n})).length}function Yf(n){if(n.length===0)return-1;let e=0,t=n[0].date;for(let r=1;r<n.length;r++)n[r].date<t&&(t=n[r].date,e=r);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xf(n){$n(new hn("platform-logger",e=>new uf(e),"PRIVATE")),$n(new hn("heartbeat",e=>new Kf(e),"PRIVATE")),Bt(Xs,ic,n),Bt(Xs,ic,"esm2020"),Bt("fire-js","")}Xf("");var Zf="firebase",ep="12.11.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Bt(Zf,ep,"app");function Lu(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const tp=Lu,Fu=new Fr("auth","Firebase",Lu());/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ni=new Io("@firebase/auth");function np(n,...e){Ni.logLevel<=Q.WARN&&Ni.warn(`Auth (${Qn}): ${n}`,...e)}function Ii(n,...e){Ni.logLevel<=Q.ERROR&&Ni.error(`Auth (${Qn}): ${n}`,...e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ht(n,...e){throw Ro(n,...e)}function Ye(n,...e){return Ro(n,...e)}function Ao(n,e,t){const r={...tp(),[e]:t};return new Fr("auth","Firebase",r).create(e,{appName:n.name})}function an(n){return Ao(n,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function rp(n,e,t){const r=t;if(!(e instanceof r))throw r.name!==e.constructor.name&&ht(n,"argument-error"),Ao(n,"argument-error",`Type of ${e.constructor.name} does not match expected instance.Did you pass a reference from a different Auth SDK?`)}function Ro(n,...e){if(typeof n!="string"){const t=e[0],r=[...e.slice(1)];return r[0]&&(r[0].appName=n.name),n._errorFactory.create(t,...r)}return Fu.create(n,...e)}function z(n,e,...t){if(!n)throw Ro(e,...t)}function _t(n){const e="INTERNAL ASSERTION FAILED: "+n;throw Ii(e),new Error(e)}function Tt(n,e){n||_t(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function to(){var n;return typeof self<"u"&&((n=self.location)==null?void 0:n.href)||""}function ip(){return uc()==="http:"||uc()==="https:"}function uc(){var n;return typeof self<"u"&&((n=self.location)==null?void 0:n.protocol)||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sp(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(ip()||kd()||"connection"in navigator)?navigator.onLine:!0}function op(){if(typeof navigator>"u")return null;const n=navigator;return n.languages&&n.languages[0]||n.language||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jr{constructor(e,t){this.shortDelay=e,this.longDelay=t,Tt(t>e,"Short delay should be less than long delay!"),this.isMobile=Pd()||Vd()}get(){return sp()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function So(n,e){Tt(n.emulator,"Emulator should always be set here");const{url:t}=n.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Uu{static initialize(e,t,r){this.fetchImpl=e,t&&(this.headersImpl=t),r&&(this.responseImpl=r)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;_t("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;_t("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;_t("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ap={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cp=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],up=new jr(3e4,6e4);function Po(n,e){return n.tenantId&&!e.tenantId?{...e,tenantId:n.tenantId}:e}async function Jn(n,e,t,r,i={}){return Bu(n,i,async()=>{let o={},a={};r&&(e==="GET"?a=r:o={body:JSON.stringify(r)});const h=Ur({key:n.config.apiKey,...a}).slice(1),f=await n._getAdditionalHeaders();f["Content-Type"]="application/json",n.languageCode&&(f["X-Firebase-Locale"]=n.languageCode);const m={method:e,headers:f,...o};return bd()||(m.referrerPolicy="no-referrer"),n.emulatorConfig&&Br(n.emulatorConfig.host)&&(m.credentials="include"),Uu.fetch()(await ju(n,n.config.apiHost,t,h),m)})}async function Bu(n,e,t){n._canInitEmulator=!1;const r={...ap,...e};try{const i=new hp(n),o=await Promise.race([t(),i.promise]);i.clearNetworkTimeout();const a=await o.json();if("needConfirmation"in a)throw pi(n,"account-exists-with-different-credential",a);if(o.ok&&!("errorMessage"in a))return a;{const h=o.ok?a.errorMessage:a.error.message,[f,m]=h.split(" : ");if(f==="FEDERATED_USER_ID_ALREADY_LINKED")throw pi(n,"credential-already-in-use",a);if(f==="EMAIL_EXISTS")throw pi(n,"email-already-in-use",a);if(f==="USER_DISABLED")throw pi(n,"user-disabled",a);const p=r[f]||f.toLowerCase().replace(/[_\s]+/g,"-");if(m)throw Ao(n,p,m);ht(n,p)}}catch(i){if(i instanceof At)throw i;ht(n,"network-request-failed",{message:String(i)})}}async function lp(n,e,t,r,i={}){const o=await Jn(n,e,t,r,i);return"mfaPendingCredential"in o&&ht(n,"multi-factor-auth-required",{_serverResponse:o}),o}async function ju(n,e,t,r){const i=`${e}${t}?${r}`,o=n,a=o.config.emulator?So(n.config,i):`${n.config.apiScheme}://${i}`;return cp.includes(t)&&(await o._persistenceManagerAvailable,o._getPersistenceType()==="COOKIE")?o._getPersistence()._getFinalTarget(a).toString():a}class hp{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,r)=>{this.timer=setTimeout(()=>r(Ye(this.auth,"network-request-failed")),up.get())})}}function pi(n,e,t){const r={appName:n.name};t.email&&(r.email=t.email),t.phoneNumber&&(r.phoneNumber=t.phoneNumber);const i=Ye(n,e,r);return i.customData._tokenResponse=t,i}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function dp(n,e){return Jn(n,"POST","/v1/accounts:delete",e)}async function xi(n,e){return Jn(n,"POST","/v1/accounts:lookup",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ir(n){if(n)try{const e=new Date(Number(n));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function fp(n,e=!1){const t=je(n),r=await t.getIdToken(e),i=Co(r);z(i&&i.exp&&i.auth_time&&i.iat,t.auth,"internal-error");const o=typeof i.firebase=="object"?i.firebase:void 0,a=o==null?void 0:o.sign_in_provider;return{claims:i,token:r,authTime:Ir(Bs(i.auth_time)),issuedAtTime:Ir(Bs(i.iat)),expirationTime:Ir(Bs(i.exp)),signInProvider:a||null,signInSecondFactor:(o==null?void 0:o.sign_in_second_factor)||null}}function Bs(n){return Number(n)*1e3}function Co(n){const[e,t,r]=n.split(".");if(e===void 0||t===void 0||r===void 0)return Ii("JWT malformed, contained fewer than 3 sections"),null;try{const i=Pu(t);return i?JSON.parse(i):(Ii("Failed to decode base64 JWT payload"),null)}catch(i){return Ii("Caught error parsing JWT payload as JSON",i==null?void 0:i.toString()),null}}function lc(n){const e=Co(n);return z(e,"internal-error"),z(typeof e.exp<"u","internal-error"),z(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Cr(n,e,t=!1){if(t)return e;try{return await e}catch(r){throw r instanceof At&&pp(r)&&n.auth.currentUser===n&&await n.auth.signOut(),r}}function pp({code:n}){return n==="auth/user-disabled"||n==="auth/user-token-expired"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mp{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){if(e){const t=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),t}else{this.errorBackoff=3e4;const r=(this.user.stsTokenManager.expirationTime??0)-Date.now()-3e5;return Math.max(0,r)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class no{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=Ir(this.lastLoginAt),this.creationTime=Ir(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Oi(n){var w;const e=n.auth,t=await n.getIdToken(),r=await Cr(n,xi(e,{idToken:t}));z(r==null?void 0:r.users.length,e,"internal-error");const i=r.users[0];n._notifyReloadListener(i);const o=(w=i.providerUserInfo)!=null&&w.length?$u(i.providerUserInfo):[],a=_p(n.providerData,o),h=n.isAnonymous,f=!(n.email&&i.passwordHash)&&!(a!=null&&a.length),m=h?f:!1,p={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:a,metadata:new no(i.createdAt,i.lastLoginAt),isAnonymous:m};Object.assign(n,p)}async function gp(n){const e=je(n);await Oi(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function _p(n,e){return[...n.filter(r=>!e.some(i=>i.providerId===r.providerId)),...e]}function $u(n){return n.map(({providerId:e,...t})=>({providerId:e,uid:t.rawId||"",displayName:t.displayName||null,email:t.email||null,phoneNumber:t.phoneNumber||null,photoURL:t.photoUrl||null}))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function yp(n,e){const t=await Bu(n,{},async()=>{const r=Ur({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:i,apiKey:o}=n.config,a=await ju(n,i,"/v1/token",`key=${o}`),h=await n._getAdditionalHeaders();h["Content-Type"]="application/x-www-form-urlencoded";const f={method:"POST",headers:h,body:r};return n.emulatorConfig&&Br(n.emulatorConfig.host)&&(f.credentials="include"),Uu.fetch()(a,f)});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function Ep(n,e){return Jn(n,"POST","/v2/accounts:revokeToken",Po(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ln{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){z(e.idToken,"internal-error"),z(typeof e.idToken<"u","internal-error"),z(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):lc(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){z(e.length!==0,"internal-error");const t=lc(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(z(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:r,refreshToken:i,expiresIn:o}=await yp(e,t);this.updateTokensAndExpiration(r,i,Number(o))}updateTokensAndExpiration(e,t,r){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+r*1e3}static fromJSON(e,t){const{refreshToken:r,accessToken:i,expirationTime:o}=t,a=new Ln;return r&&(z(typeof r=="string","internal-error",{appName:e}),a.refreshToken=r),i&&(z(typeof i=="string","internal-error",{appName:e}),a.accessToken=i),o&&(z(typeof o=="number","internal-error",{appName:e}),a.expirationTime=o),a}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new Ln,this.toJSON())}_performRefresh(){return _t("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dt(n,e){z(typeof n=="string"||typeof n>"u","internal-error",{appName:e})}class Je{constructor({uid:e,auth:t,stsTokenManager:r,...i}){this.providerId="firebase",this.proactiveRefresh=new mp(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=e,this.auth=t,this.stsTokenManager=r,this.accessToken=r.accessToken,this.displayName=i.displayName||null,this.email=i.email||null,this.emailVerified=i.emailVerified||!1,this.phoneNumber=i.phoneNumber||null,this.photoURL=i.photoURL||null,this.isAnonymous=i.isAnonymous||!1,this.tenantId=i.tenantId||null,this.providerData=i.providerData?[...i.providerData]:[],this.metadata=new no(i.createdAt||void 0,i.lastLoginAt||void 0)}async getIdToken(e){const t=await Cr(this,this.stsTokenManager.getToken(this.auth,e));return z(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return fp(this,e)}reload(){return gp(this)}_assign(e){this!==e&&(z(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>({...t})),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new Je({...this,auth:e,stsTokenManager:this.stsTokenManager._clone()});return t.metadata._copy(this.metadata),t}_onReload(e){z(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let r=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),r=!0),t&&await Oi(this),await this.auth._persistUserIfCurrent(this),r&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(Qe(this.auth.app))return Promise.reject(an(this.auth));const e=await this.getIdToken();return await Cr(this,dp(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return{uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>({...e})),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId,...this.metadata.toJSON(),apiKey:this.auth.config.apiKey,appName:this.auth.name}}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){const r=t.displayName??void 0,i=t.email??void 0,o=t.phoneNumber??void 0,a=t.photoURL??void 0,h=t.tenantId??void 0,f=t._redirectEventId??void 0,m=t.createdAt??void 0,p=t.lastLoginAt??void 0,{uid:w,emailVerified:k,isAnonymous:N,providerData:L,stsTokenManager:j}=t;z(w&&j,e,"internal-error");const U=Ln.fromJSON(this.name,j);z(typeof w=="string",e,"internal-error"),Dt(r,e.name),Dt(i,e.name),z(typeof k=="boolean",e,"internal-error"),z(typeof N=="boolean",e,"internal-error"),Dt(o,e.name),Dt(a,e.name),Dt(h,e.name),Dt(f,e.name),Dt(m,e.name),Dt(p,e.name);const ee=new Je({uid:w,auth:e,email:i,emailVerified:k,displayName:r,isAnonymous:N,photoURL:a,phoneNumber:o,tenantId:h,stsTokenManager:U,createdAt:m,lastLoginAt:p});return L&&Array.isArray(L)&&(ee.providerData=L.map(Z=>({...Z}))),f&&(ee._redirectEventId=f),ee}static async _fromIdTokenResponse(e,t,r=!1){const i=new Ln;i.updateFromServerResponse(t);const o=new Je({uid:t.localId,auth:e,stsTokenManager:i,isAnonymous:r});return await Oi(o),o}static async _fromGetAccountInfoResponse(e,t,r){const i=t.users[0];z(i.localId!==void 0,"internal-error");const o=i.providerUserInfo!==void 0?$u(i.providerUserInfo):[],a=!(i.email&&i.passwordHash)&&!(o!=null&&o.length),h=new Ln;h.updateFromIdToken(r);const f=new Je({uid:i.localId,auth:e,stsTokenManager:h,isAnonymous:a}),m={uid:i.localId,displayName:i.displayName||null,photoURL:i.photoUrl||null,email:i.email||null,emailVerified:i.emailVerified||!1,phoneNumber:i.phoneNumber||null,tenantId:i.tenantId||null,providerData:o,metadata:new no(i.createdAt,i.lastLoginAt),isAnonymous:!(i.email&&i.passwordHash)&&!(o!=null&&o.length)};return Object.assign(f,m),f}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const hc=new Map;function yt(n){Tt(n instanceof Function,"Expected a class definition");let e=hc.get(n);return e?(Tt(e instanceof n,"Instance stored in cache mismatched with class"),e):(e=new n,hc.set(n,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qu{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}qu.type="NONE";const dc=qu;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wi(n,e,t){return`firebase:${n}:${e}:${t}`}class Fn{constructor(e,t,r){this.persistence=e,this.auth=t,this.userKey=r;const{config:i,name:o}=this.auth;this.fullUserKey=wi(this.userKey,i.apiKey,o),this.fullPersistenceKey=wi("persistence",i.apiKey,o),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if(typeof e=="string"){const t=await xi(this.auth,{idToken:e}).catch(()=>{});return t?Je._fromGetAccountInfoResponse(this.auth,t,e):null}return Je._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,r="authUser"){if(!t.length)return new Fn(yt(dc),e,r);const i=(await Promise.all(t.map(async m=>{if(await m._isAvailable())return m}))).filter(m=>m);let o=i[0]||yt(dc);const a=wi(r,e.config.apiKey,e.name);let h=null;for(const m of t)try{const p=await m._get(a);if(p){let w;if(typeof p=="string"){const k=await xi(e,{idToken:p}).catch(()=>{});if(!k)break;w=await Je._fromGetAccountInfoResponse(e,k,p)}else w=Je._fromJSON(e,p);m!==o&&(h=w),o=m;break}}catch{}const f=i.filter(m=>m._shouldAllowMigration);return!o._shouldAllowMigration||!f.length?new Fn(o,e,r):(o=f[0],h&&await o._set(a,h.toJSON()),await Promise.all(t.map(async m=>{if(m!==o)try{await m._remove(a)}catch{}})),new Fn(o,e,r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fc(n){const e=n.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(Wu(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(zu(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(Qu(e))return"Blackberry";if(Ju(e))return"Webos";if(Hu(e))return"Safari";if((e.includes("chrome/")||Gu(e))&&!e.includes("edge/"))return"Chrome";if(Ku(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,r=n.match(t);if((r==null?void 0:r.length)===2)return r[1]}return"Other"}function zu(n=Ue()){return/firefox\//i.test(n)}function Hu(n=Ue()){const e=n.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function Gu(n=Ue()){return/crios\//i.test(n)}function Wu(n=Ue()){return/iemobile/i.test(n)}function Ku(n=Ue()){return/android/i.test(n)}function Qu(n=Ue()){return/blackberry/i.test(n)}function Ju(n=Ue()){return/webos/i.test(n)}function bo(n=Ue()){return/iphone|ipad|ipod/i.test(n)||/macintosh/i.test(n)&&/mobile/i.test(n)}function Tp(n=Ue()){var e;return bo(n)&&!!((e=window.navigator)!=null&&e.standalone)}function Ip(){return Dd()&&document.documentMode===10}function Yu(n=Ue()){return bo(n)||Ku(n)||Ju(n)||Qu(n)||/windows phone/i.test(n)||Wu(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xu(n,e=[]){let t;switch(n){case"Browser":t=fc(Ue());break;case"Worker":t=`${fc(Ue())}-${n}`;break;default:t=n}const r=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${Qn}/${r}`}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wp{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const r=o=>new Promise((a,h)=>{try{const f=e(o);a(f)}catch(f){h(f)}});r.onAbort=t,this.queue.push(r);const i=this.queue.length-1;return()=>{this.queue[i]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const r of this.queue)await r(e),r.onAbort&&t.push(r.onAbort)}catch(r){t.reverse();for(const i of t)try{i()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:r==null?void 0:r.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function vp(n,e={}){return Jn(n,"GET","/v2/passwordPolicy",Po(n,e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ap=6;class Rp{constructor(e){var r;const t=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=t.minPasswordLength??Ap,t.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=t.maxPasswordLength),t.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=t.containsLowercaseCharacter),t.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=t.containsUppercaseCharacter),t.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=t.containsNumericCharacter),t.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=t.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=((r=e.allowedNonAlphanumericCharacters)==null?void 0:r.join(""))??"",this.forceUpgradeOnSignin=e.forceUpgradeOnSignin??!1,this.schemaVersion=e.schemaVersion}validatePassword(e){const t={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,t),this.validatePasswordCharacterOptions(e,t),t.isValid&&(t.isValid=t.meetsMinPasswordLength??!0),t.isValid&&(t.isValid=t.meetsMaxPasswordLength??!0),t.isValid&&(t.isValid=t.containsLowercaseLetter??!0),t.isValid&&(t.isValid=t.containsUppercaseLetter??!0),t.isValid&&(t.isValid=t.containsNumericCharacter??!0),t.isValid&&(t.isValid=t.containsNonAlphanumericCharacter??!0),t}validatePasswordLengthOptions(e,t){const r=this.customStrengthOptions.minPasswordLength,i=this.customStrengthOptions.maxPasswordLength;r&&(t.meetsMinPasswordLength=e.length>=r),i&&(t.meetsMaxPasswordLength=e.length<=i)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let r;for(let i=0;i<e.length;i++)r=e.charAt(i),this.updatePasswordCharacterOptionsStatuses(t,r>="a"&&r<="z",r>="A"&&r<="Z",r>="0"&&r<="9",this.allowedNonAlphanumericCharacters.includes(r))}updatePasswordCharacterOptionsStatuses(e,t,r,i,o){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=r)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=i)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=o))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sp{constructor(e,t,r,i){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=r,this.config=i,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new pc(this),this.idTokenSubscription=new pc(this),this.beforeStateQueue=new wp(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=Fu,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=i.sdkClientVersion,this._persistenceManagerAvailable=new Promise(o=>this._resolvePersistenceManagerAvailable=o)}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=yt(t)),this._initializationPromise=this.queue(async()=>{var r,i,o;if(!this._deleted&&(this.persistenceManager=await Fn.create(this,e),(r=this._resolvePersistenceManagerAvailable)==null||r.call(this),!this._deleted)){if((i=this._popupRedirectResolver)!=null&&i._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((o=this.currentUser)==null?void 0:o.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await xi(this,{idToken:e}),r=await Je._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(r)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var o;if(Qe(this.app)){const a=this.app.settings.authIdToken;return a?new Promise(h=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(a).then(h,h))}):this.directlySetCurrentUser(null)}const t=await this.assertedPersistence.getCurrentUser();let r=t,i=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const a=(o=this.redirectUser)==null?void 0:o._redirectEventId,h=r==null?void 0:r._redirectEventId,f=await this.tryRedirectSignIn(e);(!a||a===h)&&(f!=null&&f.user)&&(r=f.user,i=!0)}if(!r)return this.directlySetCurrentUser(null);if(!r._redirectEventId){if(i)try{await this.beforeStateQueue.runMiddleware(r)}catch(a){r=t,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(a))}return r?this.reloadAndSetCurrentUserOrClear(r):this.directlySetCurrentUser(null)}return z(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===r._redirectEventId?this.directlySetCurrentUser(r):this.reloadAndSetCurrentUserOrClear(r)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await Oi(e)}catch(t){if((t==null?void 0:t.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=op()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(Qe(this.app))return Promise.reject(an(this));const t=e?je(e):null;return t&&z(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&z(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return Qe(this.app)?Promise.reject(an(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return Qe(this.app)?Promise.reject(an(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(yt(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await vp(this),t=new Rp(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new Fr("auth","Firebase",e())}onAuthStateChanged(e,t,r){return this.registerStateListener(this.authStateSubscription,e,t,r)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,r){return this.registerStateListener(this.idTokenSubscription,e,t,r)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const r=this.onAuthStateChanged(()=>{r(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),r={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(r.tenantId=this.tenantId),await Ep(this,r)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)==null?void 0:e.toJSON()}}async _setRedirectUser(e,t){const r=await this.getOrInitRedirectPersistenceManager(t);return e===null?r.removeCurrentUser():r.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&yt(e)||this._popupRedirectResolver;z(t,this,"argument-error"),this.redirectPersistenceManager=await Fn.create(this,[yt(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,r;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)==null?void 0:t._redirectEventId)===e?this._currentUser:((r=this.redirectUser)==null?void 0:r._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const e=((t=this.currentUser)==null?void 0:t.uid)??null;this.lastNotifiedUid!==e&&(this.lastNotifiedUid=e,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,r,i){if(this._deleted)return()=>{};const o=typeof t=="function"?t:t.next.bind(t);let a=!1;const h=this._isInitialized?Promise.resolve():this._initializationPromise;if(z(h,this,"internal-error"),h.then(()=>{a||o(this.currentUser)}),typeof t=="function"){const f=e.addObserver(t,r,i);return()=>{a=!0,f()}}else{const f=e.addObserver(t);return()=>{a=!0,f()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return z(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=Xu(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var i;const e={"X-Client-Version":this.clientVersion};this.app.options.appId&&(e["X-Firebase-gmpid"]=this.app.options.appId);const t=await((i=this.heartbeatServiceProvider.getImmediate({optional:!0}))==null?void 0:i.getHeartbeatsHeader());t&&(e["X-Firebase-Client"]=t);const r=await this._getAppCheckToken();return r&&(e["X-Firebase-AppCheck"]=r),e}async _getAppCheckToken(){var t;if(Qe(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=await((t=this.appCheckServiceProvider.getImmediate({optional:!0}))==null?void 0:t.getToken());return e!=null&&e.error&&np(`Error while retrieving App Check token: ${e.error}`),e==null?void 0:e.token}}function Yi(n){return je(n)}class pc{constructor(e){this.auth=e,this.observer=null,this.addObserver=Bd(t=>this.observer=t)}get next(){return z(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let ko={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function Pp(n){ko=n}function Cp(n){return ko.loadJS(n)}function bp(){return ko.gapiScript}function kp(n){return`__${n}${Math.floor(Math.random()*1e6)}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vp(n,e){const t=vo(n,"auth");if(t.isInitialized()){const i=t.getImmediate(),o=t.getOptions();if(ln(o,e??{}))return i;ht(i,"already-initialized")}return t.initialize({options:e})}function Dp(n,e){const t=(e==null?void 0:e.persistence)||[],r=(Array.isArray(t)?t:[t]).map(yt);e!=null&&e.errorMap&&n._updateErrorMap(e.errorMap),n._initializeWithPersistence(r,e==null?void 0:e.popupRedirectResolver)}function Np(n,e,t){const r=Yi(n);z(/^https?:\/\//.test(e),r,"invalid-emulator-scheme");const i=!1,o=Zu(e),{host:a,port:h}=xp(e),f=h===null?"":`:${h}`,m={url:`${o}//${a}${f}/`},p=Object.freeze({host:a,port:h,protocol:o.replace(":",""),options:Object.freeze({disableWarnings:i})});if(!r._canInitEmulator){z(r.config.emulator&&r.emulatorConfig,r,"emulator-config-failed"),z(ln(m,r.config.emulator)&&ln(p,r.emulatorConfig),r,"emulator-config-failed");return}r.config.emulator=m,r.emulatorConfig=p,r.settings.appVerificationDisabledForTesting=!0,Br(a)?Vu(`${o}//${a}${f}`):Op()}function Zu(n){const e=n.indexOf(":");return e<0?"":n.substr(0,e+1)}function xp(n){const e=Zu(n),t=/(\/\/)?([^?#/]+)/.exec(n.substr(e.length));if(!t)return{host:"",port:null};const r=t[2].split("@").pop()||"",i=/^(\[[^\]]+\])(:|$)/.exec(r);if(i){const o=i[1];return{host:o,port:mc(r.substr(o.length+1))}}else{const[o,a]=r.split(":");return{host:o,port:mc(a)}}}function mc(n){if(!n)return null;const e=Number(n);return isNaN(e)?null:e}function Op(){function n(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",n):n())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class el{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return _t("not implemented")}_getIdTokenResponse(e){return _t("not implemented")}_linkToIdToken(e,t){return _t("not implemented")}_getReauthenticationResolver(e){return _t("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Un(n,e){return lp(n,"POST","/v1/accounts:signInWithIdp",Po(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Mp="http://localhost";class dn extends el{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new dn(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):ht("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:i,...o}=t;if(!r||!i)return null;const a=new dn(r,i);return a.idToken=o.idToken||void 0,a.accessToken=o.accessToken||void 0,a.secret=o.secret,a.nonce=o.nonce,a.pendingToken=o.pendingToken||null,a}_getIdTokenResponse(e){const t=this.buildRequest();return Un(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,Un(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Un(e,t)}buildRequest(){const e={requestUri:Mp,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=Ur(t)}return e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vo{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $r extends Vo{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nt extends $r{constructor(){super("facebook.com")}static credential(e){return dn._fromParams({providerId:Nt.PROVIDER_ID,signInMethod:Nt.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Nt.credentialFromTaggedObject(e)}static credentialFromError(e){return Nt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Nt.credential(e.oauthAccessToken)}catch{return null}}}Nt.FACEBOOK_SIGN_IN_METHOD="facebook.com";Nt.PROVIDER_ID="facebook.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xt extends $r{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return dn._fromParams({providerId:xt.PROVIDER_ID,signInMethod:xt.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return xt.credentialFromTaggedObject(e)}static credentialFromError(e){return xt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r}=e;if(!t&&!r)return null;try{return xt.credential(t,r)}catch{return null}}}xt.GOOGLE_SIGN_IN_METHOD="google.com";xt.PROVIDER_ID="google.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ot extends $r{constructor(){super("github.com")}static credential(e){return dn._fromParams({providerId:Ot.PROVIDER_ID,signInMethod:Ot.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Ot.credentialFromTaggedObject(e)}static credentialFromError(e){return Ot.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Ot.credential(e.oauthAccessToken)}catch{return null}}}Ot.GITHUB_SIGN_IN_METHOD="github.com";Ot.PROVIDER_ID="github.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mt extends $r{constructor(){super("twitter.com")}static credential(e,t){return dn._fromParams({providerId:Mt.PROVIDER_ID,signInMethod:Mt.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return Mt.credentialFromTaggedObject(e)}static credentialFromError(e){return Mt.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:r}=e;if(!t||!r)return null;try{return Mt.credential(t,r)}catch{return null}}}Mt.TWITTER_SIGN_IN_METHOD="twitter.com";Mt.PROVIDER_ID="twitter.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qn{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,r,i=!1){const o=await Je._fromIdTokenResponse(e,r,i),a=gc(r);return new qn({user:o,providerId:a,_tokenResponse:r,operationType:t})}static async _forOperation(e,t,r){await e._updateTokensIfNecessary(r,!0);const i=gc(r);return new qn({user:e,providerId:i,_tokenResponse:r,operationType:t})}}function gc(n){return n.providerId?n.providerId:"phoneNumber"in n?"phone":null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mi extends At{constructor(e,t,r,i){super(t.code,t.message),this.operationType=r,this.user=i,Object.setPrototypeOf(this,Mi.prototype),this.customData={appName:e.name,tenantId:e.tenantId??void 0,_serverResponse:t.customData._serverResponse,operationType:r}}static _fromErrorAndOperation(e,t,r,i){return new Mi(e,t,r,i)}}function tl(n,e,t,r){return(e==="reauthenticate"?t._getReauthenticationResolver(n):t._getIdTokenResponse(n)).catch(o=>{throw o.code==="auth/multi-factor-auth-required"?Mi._fromErrorAndOperation(n,o,e,r):o})}async function Lp(n,e,t=!1){const r=await Cr(n,e._linkToIdToken(n.auth,await n.getIdToken()),t);return qn._forOperation(n,"link",r)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Fp(n,e,t=!1){const{auth:r}=n;if(Qe(r.app))return Promise.reject(an(r));const i="reauthenticate";try{const o=await Cr(n,tl(r,i,e,n),t);z(o.idToken,r,"internal-error");const a=Co(o.idToken);z(a,r,"internal-error");const{sub:h}=a;return z(n.uid===h,r,"user-mismatch"),qn._forOperation(n,i,o)}catch(o){throw(o==null?void 0:o.code)==="auth/user-not-found"&&ht(r,"user-mismatch"),o}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Up(n,e,t=!1){if(Qe(n.app))return Promise.reject(an(n));const r="signIn",i=await tl(n,r,e),o=await qn._fromIdTokenResponse(n,r,i);return t||await n._updateCurrentUser(o.user),o}function Bp(n,e,t,r){return je(n).onIdTokenChanged(e,t,r)}function jp(n,e,t){return je(n).beforeAuthStateChanged(e,t)}function WE(n,e,t,r){return je(n).onAuthStateChanged(e,t,r)}function KE(n){return je(n).signOut()}const Li="__sak";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nl{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(Li,"1"),this.storage.removeItem(Li),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $p=1e3,qp=10;class rl extends nl{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=Yu(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const r=this.storage.getItem(t),i=this.localCache[t];r!==i&&e(t,i,r)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((a,h,f)=>{this.notifyListeners(a,f)});return}const r=e.key;t?this.detachListener():this.stopPolling();const i=()=>{const a=this.storage.getItem(r);!t&&this.localCache[r]===a||this.notifyListeners(r,a)},o=this.storage.getItem(r);Ip()&&o!==e.newValue&&e.newValue!==e.oldValue?setTimeout(i,qp):i()}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,r)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:r}),!0)})},$p)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}rl.type="LOCAL";const zp=rl;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class il extends nl{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}il.type="SESSION";const sl=il;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hp(n){return Promise.all(n.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xi{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(i=>i.isListeningto(e));if(t)return t;const r=new Xi(e);return this.receivers.push(r),r}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:r,eventType:i,data:o}=t.data,a=this.handlersMap[i];if(!(a!=null&&a.size))return;t.ports[0].postMessage({status:"ack",eventId:r,eventType:i});const h=Array.from(a).map(async m=>m(t.origin,o)),f=await Hp(h);t.ports[0].postMessage({status:"done",eventId:r,eventType:i,response:f})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}Xi.receivers=[];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Do(n="",e=10){let t="";for(let r=0;r<e;r++)t+=Math.floor(Math.random()*10);return n+t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gp{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,r=50){const i=typeof MessageChannel<"u"?new MessageChannel:null;if(!i)throw new Error("connection_unavailable");let o,a;return new Promise((h,f)=>{const m=Do("",20);i.port1.start();const p=setTimeout(()=>{f(new Error("unsupported_event"))},r);a={messageChannel:i,onMessage(w){const k=w;if(k.data.eventId===m)switch(k.data.status){case"ack":clearTimeout(p),o=setTimeout(()=>{f(new Error("timeout"))},3e3);break;case"done":clearTimeout(o),h(k.data.response);break;default:clearTimeout(p),clearTimeout(o),f(new Error("invalid_response"));break}}},this.handlers.add(a),i.port1.addEventListener("message",a.onMessage),this.target.postMessage({eventType:e,eventId:m,data:t},[i.port2])}).finally(()=>{a&&this.removeMessageHandler(a)})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ot(){return window}function Wp(n){ot().location.href=n}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ol(){return typeof ot().WorkerGlobalScope<"u"&&typeof ot().importScripts=="function"}async function Kp(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function Qp(){var n;return((n=navigator==null?void 0:navigator.serviceWorker)==null?void 0:n.controller)||null}function Jp(){return ol()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const al="firebaseLocalStorageDb",Yp=1,Fi="firebaseLocalStorage",cl="fbase_key";class qr{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function Zi(n,e){return n.transaction([Fi],e?"readwrite":"readonly").objectStore(Fi)}function Xp(){const n=indexedDB.deleteDatabase(al);return new qr(n).toPromise()}function ro(){const n=indexedDB.open(al,Yp);return new Promise((e,t)=>{n.addEventListener("error",()=>{t(n.error)}),n.addEventListener("upgradeneeded",()=>{const r=n.result;try{r.createObjectStore(Fi,{keyPath:cl})}catch(i){t(i)}}),n.addEventListener("success",async()=>{const r=n.result;r.objectStoreNames.contains(Fi)?e(r):(r.close(),await Xp(),e(await ro()))})})}async function _c(n,e,t){const r=Zi(n,!0).put({[cl]:e,value:t});return new qr(r).toPromise()}async function Zp(n,e){const t=Zi(n,!1).get(e),r=await new qr(t).toPromise();return r===void 0?null:r.value}function yc(n,e){const t=Zi(n,!0).delete(e);return new qr(t).toPromise()}const em=800,tm=3;class ul{constructor(){this.type="LOCAL",this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.db?this.db:(this.db=await ro(),this.db)}async _withRetries(e){let t=0;for(;;)try{const r=await this._openDb();return await e(r)}catch(r){if(t++>tm)throw r;this.db&&(this.db.close(),this.db=void 0)}}async initializeServiceWorkerMessaging(){return ol()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=Xi._getInstance(Jp()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var t,r;if(this.activeServiceWorker=await Kp(),!this.activeServiceWorker)return;this.sender=new Gp(this.activeServiceWorker);const e=await this.sender._send("ping",{},800);e&&(t=e[0])!=null&&t.fulfilled&&(r=e[0])!=null&&r.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||Qp()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{if(!indexedDB)return!1;const e=await ro();return await _c(e,Li,"1"),await yc(e,Li),!0}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(r=>_c(r,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(r=>Zp(r,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>yc(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(i=>{const o=Zi(i,!1).getAll();return new qr(o).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],r=new Set;if(e.length!==0)for(const{fbase_key:i,value:o}of e)r.add(i),JSON.stringify(this.localCache[i])!==JSON.stringify(o)&&(this.notifyListeners(i,o),t.push(i));for(const i of Object.keys(this.localCache))this.localCache[i]&&!r.has(i)&&(this.notifyListeners(i,null),t.push(i));return t}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const i of Array.from(r))i(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),em)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}ul.type="LOCAL";const nm=ul;new jr(3e4,6e4);/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ll(n,e){return e?yt(e):(z(n._popupRedirectResolver,n,"argument-error"),n._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class No extends el{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return Un(e,this._buildIdpRequest())}_linkToIdToken(e,t){return Un(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return Un(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function rm(n){return Up(n.auth,new No(n),n.bypassAuthState)}function im(n){const{auth:e,user:t}=n;return z(t,e,"internal-error"),Fp(t,new No(n),n.bypassAuthState)}async function sm(n){const{auth:e,user:t}=n;return z(t,e,"internal-error"),Lp(t,new No(n),n.bypassAuthState)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hl{constructor(e,t,r,i,o=!1){this.auth=e,this.resolver=r,this.user=i,this.bypassAuthState=o,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(r){this.reject(r)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:r,postBody:i,tenantId:o,error:a,type:h}=e;if(a){this.reject(a);return}const f={auth:this.auth,requestUri:t,sessionId:r,tenantId:o||void 0,postBody:i||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(h)(f))}catch(m){this.reject(m)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return rm;case"linkViaPopup":case"linkViaRedirect":return sm;case"reauthViaPopup":case"reauthViaRedirect":return im;default:ht(this.auth,"internal-error")}}resolve(e){Tt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){Tt(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const om=new jr(2e3,1e4);async function QE(n,e,t){if(Qe(n.app))return Promise.reject(Ye(n,"operation-not-supported-in-this-environment"));const r=Yi(n);rp(n,e,Vo);const i=ll(r,t);return new sn(r,"signInViaPopup",e,i).executeNotNull()}class sn extends hl{constructor(e,t,r,i,o){super(e,t,i,o),this.provider=r,this.authWindow=null,this.pollId=null,sn.currentPopupAction&&sn.currentPopupAction.cancel(),sn.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return z(e,this.auth,"internal-error"),e}async onExecution(){Tt(this.filter.length===1,"Popup operations only handle one event");const e=Do();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject(Ye(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)==null?void 0:e.associatedEvent)||null}cancel(){this.reject(Ye(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,sn.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,r;if((r=(t=this.authWindow)==null?void 0:t.window)!=null&&r.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(Ye(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,om.get())};e()}}sn.currentPopupAction=null;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const am="pendingRedirect",vi=new Map;class cm extends hl{constructor(e,t,r=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,r),this.eventId=null}async execute(){let e=vi.get(this.auth._key());if(!e){try{const r=await um(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(r)}catch(t){e=()=>Promise.reject(t)}vi.set(this.auth._key(),e)}return this.bypassAuthState||vi.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function um(n,e){const t=dm(e),r=hm(n);if(!await r._isAvailable())return!1;const i=await r._get(t)==="true";return await r._remove(t),i}function lm(n,e){vi.set(n._key(),e)}function hm(n){return yt(n._redirectPersistence)}function dm(n){return wi(am,n.config.apiKey,n.name)}async function fm(n,e,t=!1){if(Qe(n.app))return Promise.reject(an(n));const r=Yi(n),i=ll(r,e),a=await new cm(r,i,t).execute();return a&&!t&&(delete a.user._redirectEventId,await r._persistUserIfCurrent(a.user),await r._setRedirectUser(null,e)),a}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pm=10*60*1e3;class mm{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(r=>{this.isEventForConsumer(e,r)&&(t=!0,this.sendToConsumer(e,r),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!gm(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var r;if(e.error&&!dl(e)){const i=((r=e.error.code)==null?void 0:r.split("auth/")[1])||"internal-error";t.onError(Ye(this.auth,i))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const r=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&r}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=pm&&this.cachedEventUids.clear(),this.cachedEventUids.has(Ec(e))}saveEventToCache(e){this.cachedEventUids.add(Ec(e)),this.lastProcessedEventTime=Date.now()}}function Ec(n){return[n.type,n.eventId,n.sessionId,n.tenantId].filter(e=>e).join("-")}function dl({type:n,error:e}){return n==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function gm(n){switch(n.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return dl(n);default:return!1}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _m(n,e={}){return Jn(n,"GET","/v1/projects",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ym=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,Em=/^https?/;async function Tm(n){if(n.config.emulator)return;const{authorizedDomains:e}=await _m(n);for(const t of e)try{if(Im(t))return}catch{}ht(n,"unauthorized-domain")}function Im(n){const e=to(),{protocol:t,hostname:r}=new URL(e);if(n.startsWith("chrome-extension://")){const a=new URL(n);return a.hostname===""&&r===""?t==="chrome-extension:"&&n.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&a.hostname===r}if(!Em.test(t))return!1;if(ym.test(n))return r===n;const i=n.replace(/\./g,"\\.");return new RegExp("^(.+\\."+i+"|"+i+")$","i").test(r)}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wm=new jr(3e4,6e4);function Tc(){const n=ot().___jsl;if(n!=null&&n.H){for(const e of Object.keys(n.H))if(n.H[e].r=n.H[e].r||[],n.H[e].L=n.H[e].L||[],n.H[e].r=[...n.H[e].L],n.CP)for(let t=0;t<n.CP.length;t++)n.CP[t]=null}}function vm(n){return new Promise((e,t)=>{var i,o,a;function r(){Tc(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{Tc(),t(Ye(n,"network-request-failed"))},timeout:wm.get()})}if((o=(i=ot().gapi)==null?void 0:i.iframes)!=null&&o.Iframe)e(gapi.iframes.getContext());else if((a=ot().gapi)!=null&&a.load)r();else{const h=kp("iframefcb");return ot()[h]=()=>{gapi.load?r():t(Ye(n,"network-request-failed"))},Cp(`${bp()}?onload=${h}`).catch(f=>t(f))}}).catch(e=>{throw Ai=null,e})}let Ai=null;function Am(n){return Ai=Ai||vm(n),Ai}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rm=new jr(5e3,15e3),Sm="__/auth/iframe",Pm="emulator/auth/iframe",Cm={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},bm=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function km(n){const e=n.config;z(e.authDomain,n,"auth-domain-config-required");const t=e.emulator?So(e,Pm):`https://${n.config.authDomain}/${Sm}`,r={apiKey:e.apiKey,appName:n.name,v:Qn},i=bm.get(n.config.apiHost);i&&(r.eid=i);const o=n._getFrameworks();return o.length&&(r.fw=o.join(",")),`${t}?${Ur(r).slice(1)}`}async function Vm(n){const e=await Am(n),t=ot().gapi;return z(t,n,"internal-error"),e.open({where:document.body,url:km(n),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:Cm,dontclear:!0},r=>new Promise(async(i,o)=>{await r.restyle({setHideOnLeave:!1});const a=Ye(n,"network-request-failed"),h=ot().setTimeout(()=>{o(a)},Rm.get());function f(){ot().clearTimeout(h),i(r)}r.ping(f).then(f,()=>{o(a)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Dm={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},Nm=500,xm=600,Om="_blank",Mm="http://localhost";class Ic{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function Lm(n,e,t,r=Nm,i=xm){const o=Math.max((window.screen.availHeight-i)/2,0).toString(),a=Math.max((window.screen.availWidth-r)/2,0).toString();let h="";const f={...Dm,width:r.toString(),height:i.toString(),top:o,left:a},m=Ue().toLowerCase();t&&(h=Gu(m)?Om:t),zu(m)&&(e=e||Mm,f.scrollbars="yes");const p=Object.entries(f).reduce((k,[N,L])=>`${k}${N}=${L},`,"");if(Tp(m)&&h!=="_self")return Fm(e||"",h),new Ic(null);const w=window.open(e||"",h,p);z(w,n,"popup-blocked");try{w.focus()}catch{}return new Ic(w)}function Fm(n,e){const t=document.createElement("a");t.href=n,t.target=e;const r=document.createEvent("MouseEvent");r.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(r)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Um="__/auth/handler",Bm="emulator/auth/handler",jm=encodeURIComponent("fac");async function wc(n,e,t,r,i,o){z(n.config.authDomain,n,"auth-domain-config-required"),z(n.config.apiKey,n,"invalid-api-key");const a={apiKey:n.config.apiKey,appName:n.name,authType:t,redirectUrl:r,v:Qn,eventId:i};if(e instanceof Vo){e.setDefaultLanguage(n.languageCode),a.providerId=e.providerId||"",Ud(e.getCustomParameters())||(a.customParameters=JSON.stringify(e.getCustomParameters()));for(const[p,w]of Object.entries({}))a[p]=w}if(e instanceof $r){const p=e.getScopes().filter(w=>w!=="");p.length>0&&(a.scopes=p.join(","))}n.tenantId&&(a.tid=n.tenantId);const h=a;for(const p of Object.keys(h))h[p]===void 0&&delete h[p];const f=await n._getAppCheckToken(),m=f?`#${jm}=${encodeURIComponent(f)}`:"";return`${$m(n)}?${Ur(h).slice(1)}${m}`}function $m({config:n}){return n.emulator?So(n,Bm):`https://${n.authDomain}/${Um}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const js="webStorageSupport";class qm{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=sl,this._completeRedirectFn=fm,this._overrideRedirectResult=lm}async _openPopup(e,t,r,i){var a;Tt((a=this.eventManagers[e._key()])==null?void 0:a.manager,"_initialize() not called before _openPopup()");const o=await wc(e,t,r,to(),i);return Lm(e,o,Do())}async _openRedirect(e,t,r,i){await this._originValidation(e);const o=await wc(e,t,r,to(),i);return Wp(o),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:i,promise:o}=this.eventManagers[t];return i?Promise.resolve(i):(Tt(o,"If manager is not set, promise should be"),o)}const r=this.initAndGetManager(e);return this.eventManagers[t]={promise:r},r.catch(()=>{delete this.eventManagers[t]}),r}async initAndGetManager(e){const t=await Vm(e),r=new mm(e);return t.register("authEvent",i=>(z(i==null?void 0:i.authEvent,e,"invalid-auth-event"),{status:r.onEvent(i.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:r},this.iframes[e._key()]=t,r}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(js,{type:js},i=>{var a;const o=(a=i==null?void 0:i[0])==null?void 0:a[js];o!==void 0&&t(!!o),ht(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=Tm(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return Yu()||Hu()||bo()}}const zm=qm;var vc="@firebase/auth",Ac="1.12.2";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hm{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)==null?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(r=>{e((r==null?void 0:r.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){z(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Gm(n){switch(n){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function Wm(n){$n(new hn("auth",(e,{options:t})=>{const r=e.getProvider("app").getImmediate(),i=e.getProvider("heartbeat"),o=e.getProvider("app-check-internal"),{apiKey:a,authDomain:h}=r.options;z(a&&!a.includes(":"),"invalid-api-key",{appName:r.name});const f={apiKey:a,authDomain:h,clientPlatform:n,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:Xu(n)},m=new Sp(r,i,o,f);return Dp(m,t),m},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider("auth-internal").initialize()})),$n(new hn("auth-internal",e=>{const t=Yi(e.getProvider("auth").getImmediate());return(r=>new Hm(r))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),Bt(vc,Ac,Gm(n)),Bt(vc,Ac,"esm2020")}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Km=5*60,Qm=ku("authIdTokenMaxAge")||Km;let Rc=null;const Jm=n=>async e=>{const t=e&&await e.getIdTokenResult(),r=t&&(new Date().getTime()-Date.parse(t.issuedAtTime))/1e3;if(r&&r>Qm)return;const i=t==null?void 0:t.token;Rc!==i&&(Rc=i,await fetch(n,{method:i?"POST":"DELETE",headers:i?{Authorization:`Bearer ${i}`}:{}}))};function JE(n=xu()){const e=vo(n,"auth");if(e.isInitialized())return e.getImmediate();const t=Vp(n,{popupRedirectResolver:zm,persistence:[nm,zp,sl]}),r=ku("authTokenSyncURL");if(r&&typeof isSecureContext=="boolean"&&isSecureContext){const o=new URL(r,location.origin);if(location.origin===o.origin){const a=Jm(o.toString());jp(t,a,()=>a(t.currentUser)),Bp(t,h=>a(h))}}const i=Cu("auth");return i&&Np(t,`http://${i}`),t}function Ym(){var n;return((n=document.getElementsByTagName("head"))==null?void 0:n[0])??document}Pp({loadJS(n){return new Promise((e,t)=>{const r=document.createElement("script");r.setAttribute("src",n),r.onload=e,r.onerror=i=>{const o=Ye("internal-error");o.customData=i,t(o)},r.type="text/javascript",r.charset="UTF-8",Ym().appendChild(r)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});Wm("Browser");var Ae={},es={};es.byteLength=eg;es.toByteArray=ng;es.fromByteArray=sg;var st=[],We=[],Xm=typeof Uint8Array<"u"?Uint8Array:Array,$s="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";for(var Vn=0,Zm=$s.length;Vn<Zm;++Vn)st[Vn]=$s[Vn],We[$s.charCodeAt(Vn)]=Vn;We[45]=62;We[95]=63;function fl(n){var e=n.length;if(e%4>0)throw new Error("Invalid string. Length must be a multiple of 4");var t=n.indexOf("=");t===-1&&(t=e);var r=t===e?0:4-t%4;return[t,r]}function eg(n){var e=fl(n),t=e[0],r=e[1];return(t+r)*3/4-r}function tg(n,e,t){return(e+t)*3/4-t}function ng(n){var e,t=fl(n),r=t[0],i=t[1],o=new Xm(tg(n,r,i)),a=0,h=i>0?r-4:r,f;for(f=0;f<h;f+=4)e=We[n.charCodeAt(f)]<<18|We[n.charCodeAt(f+1)]<<12|We[n.charCodeAt(f+2)]<<6|We[n.charCodeAt(f+3)],o[a++]=e>>16&255,o[a++]=e>>8&255,o[a++]=e&255;return i===2&&(e=We[n.charCodeAt(f)]<<2|We[n.charCodeAt(f+1)]>>4,o[a++]=e&255),i===1&&(e=We[n.charCodeAt(f)]<<10|We[n.charCodeAt(f+1)]<<4|We[n.charCodeAt(f+2)]>>2,o[a++]=e>>8&255,o[a++]=e&255),o}function rg(n){return st[n>>18&63]+st[n>>12&63]+st[n>>6&63]+st[n&63]}function ig(n,e,t){for(var r,i=[],o=e;o<t;o+=3)r=(n[o]<<16&16711680)+(n[o+1]<<8&65280)+(n[o+2]&255),i.push(rg(r));return i.join("")}function sg(n){for(var e,t=n.length,r=t%3,i=[],o=16383,a=0,h=t-r;a<h;a+=o)i.push(ig(n,a,a+o>h?h:a+o));return r===1?(e=n[t-1],i.push(st[e>>2]+st[e<<4&63]+"==")):r===2&&(e=(n[t-2]<<8)+n[t-1],i.push(st[e>>10]+st[e>>4&63]+st[e<<2&63]+"=")),i.join("")}var xo={};/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */xo.read=function(n,e,t,r,i){var o,a,h=i*8-r-1,f=(1<<h)-1,m=f>>1,p=-7,w=t?i-1:0,k=t?-1:1,N=n[e+w];for(w+=k,o=N&(1<<-p)-1,N>>=-p,p+=h;p>0;o=o*256+n[e+w],w+=k,p-=8);for(a=o&(1<<-p)-1,o>>=-p,p+=r;p>0;a=a*256+n[e+w],w+=k,p-=8);if(o===0)o=1-m;else{if(o===f)return a?NaN:(N?-1:1)*(1/0);a=a+Math.pow(2,r),o=o-m}return(N?-1:1)*a*Math.pow(2,o-r)};xo.write=function(n,e,t,r,i,o){var a,h,f,m=o*8-i-1,p=(1<<m)-1,w=p>>1,k=i===23?Math.pow(2,-24)-Math.pow(2,-77):0,N=r?0:o-1,L=r?1:-1,j=e<0||e===0&&1/e<0?1:0;for(e=Math.abs(e),isNaN(e)||e===1/0?(h=isNaN(e)?1:0,a=p):(a=Math.floor(Math.log(e)/Math.LN2),e*(f=Math.pow(2,-a))<1&&(a--,f*=2),a+w>=1?e+=k/f:e+=k*Math.pow(2,1-w),e*f>=2&&(a++,f/=2),a+w>=p?(h=0,a=p):a+w>=1?(h=(e*f-1)*Math.pow(2,i),a=a+w):(h=e*Math.pow(2,w-1)*Math.pow(2,i),a=0));i>=8;n[t+N]=h&255,N+=L,h/=256,i-=8);for(a=a<<i|h,m+=i;m>0;n[t+N]=a&255,N+=L,a/=256,m-=8);n[t+N-L]|=j*128};/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */(function(n){const e=es,t=xo,r=typeof Symbol=="function"&&typeof Symbol.for=="function"?Symbol.for("nodejs.util.inspect.custom"):null;n.Buffer=p,n.SlowBuffer=Re,n.INSPECT_MAX_BYTES=50;const i=2147483647;n.kMaxLength=i;const{Uint8Array:o,ArrayBuffer:a,SharedArrayBuffer:h}=globalThis;p.TYPED_ARRAY_SUPPORT=f(),!p.TYPED_ARRAY_SUPPORT&&typeof console<"u"&&typeof console.error=="function"&&console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support.");function f(){try{const g=new o(1),u={foo:function(){return 42}};return Object.setPrototypeOf(u,o.prototype),Object.setPrototypeOf(g,u),g.foo()===42}catch{return!1}}Object.defineProperty(p.prototype,"parent",{enumerable:!0,get:function(){if(p.isBuffer(this))return this.buffer}}),Object.defineProperty(p.prototype,"offset",{enumerable:!0,get:function(){if(p.isBuffer(this))return this.byteOffset}});function m(g){if(g>i)throw new RangeError('The value "'+g+'" is invalid for option "size"');const u=new o(g);return Object.setPrototypeOf(u,p.prototype),u}function p(g,u,l){if(typeof g=="number"){if(typeof u=="string")throw new TypeError('The "string" argument must be of type string. Received type number');return L(g)}return w(g,u,l)}p.poolSize=8192;function w(g,u,l){if(typeof g=="string")return j(g,u);if(a.isView(g))return ee(g);if(g==null)throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type "+typeof g);if(Oe(g,a)||g&&Oe(g.buffer,a)||typeof h<"u"&&(Oe(g,h)||g&&Oe(g.buffer,h)))return Z(g,u,l);if(typeof g=="number")throw new TypeError('The "value" argument must not be of type number. Received type number');const y=g.valueOf&&g.valueOf();if(y!=null&&y!==g)return p.from(y,u,l);const A=ue(g);if(A)return A;if(typeof Symbol<"u"&&Symbol.toPrimitive!=null&&typeof g[Symbol.toPrimitive]=="function")return p.from(g[Symbol.toPrimitive]("string"),u,l);throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type "+typeof g)}p.from=function(g,u,l){return w(g,u,l)},Object.setPrototypeOf(p.prototype,o.prototype),Object.setPrototypeOf(p,o);function k(g){if(typeof g!="number")throw new TypeError('"size" argument must be of type number');if(g<0)throw new RangeError('The value "'+g+'" is invalid for option "size"')}function N(g,u,l){return k(g),g<=0?m(g):u!==void 0?typeof l=="string"?m(g).fill(u,l):m(g).fill(u):m(g)}p.alloc=function(g,u,l){return N(g,u,l)};function L(g){return k(g),m(g<0?0:Ne(g)|0)}p.allocUnsafe=function(g){return L(g)},p.allocUnsafeSlow=function(g){return L(g)};function j(g,u){if((typeof u!="string"||u==="")&&(u="utf8"),!p.isEncoding(u))throw new TypeError("Unknown encoding: "+u);const l=ye(g,u)|0;let y=m(l);const A=y.write(g,u);return A!==l&&(y=y.slice(0,A)),y}function U(g){const u=g.length<0?0:Ne(g.length)|0,l=m(u);for(let y=0;y<u;y+=1)l[y]=g[y]&255;return l}function ee(g){if(Oe(g,o)){const u=new o(g);return Z(u.buffer,u.byteOffset,u.byteLength)}return U(g)}function Z(g,u,l){if(u<0||g.byteLength<u)throw new RangeError('"offset" is outside of buffer bounds');if(g.byteLength<u+(l||0))throw new RangeError('"length" is outside of buffer bounds');let y;return u===void 0&&l===void 0?y=new o(g):l===void 0?y=new o(g,u):y=new o(g,u,l),Object.setPrototypeOf(y,p.prototype),y}function ue(g){if(p.isBuffer(g)){const u=Ne(g.length)|0,l=m(u);return l.length===0||g.copy(l,0,0,u),l}if(g.length!==void 0)return typeof g.length!="number"||Pn(g.length)?m(0):U(g);if(g.type==="Buffer"&&Array.isArray(g.data))return U(g.data)}function Ne(g){if(g>=i)throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+i.toString(16)+" bytes");return g|0}function Re(g){return+g!=g&&(g=0),p.alloc(+g)}p.isBuffer=function(u){return u!=null&&u._isBuffer===!0&&u!==p.prototype},p.compare=function(u,l){if(Oe(u,o)&&(u=p.from(u,u.offset,u.byteLength)),Oe(l,o)&&(l=p.from(l,l.offset,l.byteLength)),!p.isBuffer(u)||!p.isBuffer(l))throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');if(u===l)return 0;let y=u.length,A=l.length;for(let b=0,D=Math.min(y,A);b<D;++b)if(u[b]!==l[b]){y=u[b],A=l[b];break}return y<A?-1:A<y?1:0},p.isEncoding=function(u){switch(String(u).toLowerCase()){case"hex":case"utf8":case"utf-8":case"ascii":case"latin1":case"binary":case"base64":case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return!0;default:return!1}},p.concat=function(u,l){if(!Array.isArray(u))throw new TypeError('"list" argument must be an Array of Buffers');if(u.length===0)return p.alloc(0);let y;if(l===void 0)for(l=0,y=0;y<u.length;++y)l+=u[y].length;const A=p.allocUnsafe(l);let b=0;for(y=0;y<u.length;++y){let D=u[y];if(Oe(D,o))b+D.length>A.length?(p.isBuffer(D)||(D=p.from(D)),D.copy(A,b)):o.prototype.set.call(A,D,b);else if(p.isBuffer(D))D.copy(A,b);else throw new TypeError('"list" argument must be an Array of Buffers');b+=D.length}return A};function ye(g,u){if(p.isBuffer(g))return g.length;if(a.isView(g)||Oe(g,a))return g.byteLength;if(typeof g!="string")throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type '+typeof g);const l=g.length,y=arguments.length>2&&arguments[2]===!0;if(!y&&l===0)return 0;let A=!1;for(;;)switch(u){case"ascii":case"latin1":case"binary":return l;case"utf8":case"utf-8":return Ee(g).length;case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return l*2;case"hex":return l>>>1;case"base64":return nr(g).length;default:if(A)return y?-1:Ee(g).length;u=(""+u).toLowerCase(),A=!0}}p.byteLength=ye;function R(g,u,l){let y=!1;if((u===void 0||u<0)&&(u=0),u>this.length||((l===void 0||l>this.length)&&(l=this.length),l<=0)||(l>>>=0,u>>>=0,l<=u))return"";for(g||(g="utf8");;)switch(g){case"hex":return Yr(this,u,l);case"utf8":case"utf-8":return Qr(this,u,l);case"ascii":return ys(this,u,l);case"latin1":case"binary":return Jr(this,u,l);case"base64":return _s(this,u,l);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return Xr(this,u,l);default:if(y)throw new TypeError("Unknown encoding: "+g);g=(g+"").toLowerCase(),y=!0}}p.prototype._isBuffer=!0;function E(g,u,l){const y=g[u];g[u]=g[l],g[l]=y}p.prototype.swap16=function(){const u=this.length;if(u%2!==0)throw new RangeError("Buffer size must be a multiple of 16-bits");for(let l=0;l<u;l+=2)E(this,l,l+1);return this},p.prototype.swap32=function(){const u=this.length;if(u%4!==0)throw new RangeError("Buffer size must be a multiple of 32-bits");for(let l=0;l<u;l+=4)E(this,l,l+3),E(this,l+1,l+2);return this},p.prototype.swap64=function(){const u=this.length;if(u%8!==0)throw new RangeError("Buffer size must be a multiple of 64-bits");for(let l=0;l<u;l+=8)E(this,l,l+7),E(this,l+1,l+6),E(this,l+2,l+5),E(this,l+3,l+4);return this},p.prototype.toString=function(){const u=this.length;return u===0?"":arguments.length===0?Qr(this,0,u):R.apply(this,arguments)},p.prototype.toLocaleString=p.prototype.toString,p.prototype.equals=function(u){if(!p.isBuffer(u))throw new TypeError("Argument must be a Buffer");return this===u?!0:p.compare(this,u)===0},p.prototype.inspect=function(){let u="";const l=n.INSPECT_MAX_BYTES;return u=this.toString("hex",0,l).replace(/(.{2})/g,"$1 ").trim(),this.length>l&&(u+=" ... "),"<Buffer "+u+">"},r&&(p.prototype[r]=p.prototype.inspect),p.prototype.compare=function(u,l,y,A,b){if(Oe(u,o)&&(u=p.from(u,u.offset,u.byteLength)),!p.isBuffer(u))throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type '+typeof u);if(l===void 0&&(l=0),y===void 0&&(y=u?u.length:0),A===void 0&&(A=0),b===void 0&&(b=this.length),l<0||y>u.length||A<0||b>this.length)throw new RangeError("out of range index");if(A>=b&&l>=y)return 0;if(A>=b)return-1;if(l>=y)return 1;if(l>>>=0,y>>>=0,A>>>=0,b>>>=0,this===u)return 0;let D=b-A,W=y-l;const ie=Math.min(D,W),se=this.slice(A,b),re=u.slice(l,y);for(let te=0;te<ie;++te)if(se[te]!==re[te]){D=se[te],W=re[te];break}return D<W?-1:W<D?1:0};function I(g,u,l,y,A){if(g.length===0)return-1;if(typeof l=="string"?(y=l,l=0):l>2147483647?l=2147483647:l<-2147483648&&(l=-2147483648),l=+l,Pn(l)&&(l=A?0:g.length-1),l<0&&(l=g.length+l),l>=g.length){if(A)return-1;l=g.length-1}else if(l<0)if(A)l=0;else return-1;if(typeof u=="string"&&(u=p.from(u,y)),p.isBuffer(u))return u.length===0?-1:S(g,u,l,y,A);if(typeof u=="number")return u=u&255,typeof o.prototype.indexOf=="function"?A?o.prototype.indexOf.call(g,u,l):o.prototype.lastIndexOf.call(g,u,l):S(g,[u],l,y,A);throw new TypeError("val must be string, number or Buffer")}function S(g,u,l,y,A){let b=1,D=g.length,W=u.length;if(y!==void 0&&(y=String(y).toLowerCase(),y==="ucs2"||y==="ucs-2"||y==="utf16le"||y==="utf-16le")){if(g.length<2||u.length<2)return-1;b=2,D/=2,W/=2,l/=2}function ie(re,te){return b===1?re[te]:re.readUInt16BE(te*b)}let se;if(A){let re=-1;for(se=l;se<D;se++)if(ie(g,se)===ie(u,re===-1?0:se-re)){if(re===-1&&(re=se),se-re+1===W)return re*b}else re!==-1&&(se-=se-re),re=-1}else for(l+W>D&&(l=D-W),se=l;se>=0;se--){let re=!0;for(let te=0;te<W;te++)if(ie(g,se+te)!==ie(u,te)){re=!1;break}if(re)return se}return-1}p.prototype.includes=function(u,l,y){return this.indexOf(u,l,y)!==-1},p.prototype.indexOf=function(u,l,y){return I(this,u,l,y,!0)},p.prototype.lastIndexOf=function(u,l,y){return I(this,u,l,y,!1)};function v(g,u,l,y){l=Number(l)||0;const A=g.length-l;y?(y=Number(y),y>A&&(y=A)):y=A;const b=u.length;y>b/2&&(y=b/2);let D;for(D=0;D<y;++D){const W=parseInt(u.substr(D*2,2),16);if(Pn(W))return D;g[l+D]=W}return D}function C(g,u,l,y){return Sn(Ee(u,g.length-l),g,l,y)}function T(g,u,l,y){return Sn(Rn(u),g,l,y)}function xe(g,u,l,y){return Sn(nr(u),g,l,y)}function pt(g,u,l,y){return Sn(Es(u,g.length-l),g,l,y)}p.prototype.write=function(u,l,y,A){if(l===void 0)A="utf8",y=this.length,l=0;else if(y===void 0&&typeof l=="string")A=l,y=this.length,l=0;else if(isFinite(l))l=l>>>0,isFinite(y)?(y=y>>>0,A===void 0&&(A="utf8")):(A=y,y=void 0);else throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");const b=this.length-l;if((y===void 0||y>b)&&(y=b),u.length>0&&(y<0||l<0)||l>this.length)throw new RangeError("Attempt to write outside buffer bounds");A||(A="utf8");let D=!1;for(;;)switch(A){case"hex":return v(this,u,l,y);case"utf8":case"utf-8":return C(this,u,l,y);case"ascii":case"latin1":case"binary":return T(this,u,l,y);case"base64":return xe(this,u,l,y);case"ucs2":case"ucs-2":case"utf16le":case"utf-16le":return pt(this,u,l,y);default:if(D)throw new TypeError("Unknown encoding: "+A);A=(""+A).toLowerCase(),D=!0}},p.prototype.toJSON=function(){return{type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};function _s(g,u,l){return u===0&&l===g.length?e.fromByteArray(g):e.fromByteArray(g.slice(u,l))}function Qr(g,u,l){l=Math.min(g.length,l);const y=[];let A=u;for(;A<l;){const b=g[A];let D=null,W=b>239?4:b>223?3:b>191?2:1;if(A+W<=l){let ie,se,re,te;switch(W){case 1:b<128&&(D=b);break;case 2:ie=g[A+1],(ie&192)===128&&(te=(b&31)<<6|ie&63,te>127&&(D=te));break;case 3:ie=g[A+1],se=g[A+2],(ie&192)===128&&(se&192)===128&&(te=(b&15)<<12|(ie&63)<<6|se&63,te>2047&&(te<55296||te>57343)&&(D=te));break;case 4:ie=g[A+1],se=g[A+2],re=g[A+3],(ie&192)===128&&(se&192)===128&&(re&192)===128&&(te=(b&15)<<18|(ie&63)<<12|(se&63)<<6|re&63,te>65535&&te<1114112&&(D=te))}}D===null?(D=65533,W=1):D>65535&&(D-=65536,y.push(D>>>10&1023|55296),D=56320|D&1023),y.push(D),A+=W}return En(y)}const Yt=4096;function En(g){const u=g.length;if(u<=Yt)return String.fromCharCode.apply(String,g);let l="",y=0;for(;y<u;)l+=String.fromCharCode.apply(String,g.slice(y,y+=Yt));return l}function ys(g,u,l){let y="";l=Math.min(g.length,l);for(let A=u;A<l;++A)y+=String.fromCharCode(g[A]&127);return y}function Jr(g,u,l){let y="";l=Math.min(g.length,l);for(let A=u;A<l;++A)y+=String.fromCharCode(g[A]);return y}function Yr(g,u,l){const y=g.length;(!u||u<0)&&(u=0),(!l||l<0||l>y)&&(l=y);let A="";for(let b=u;b<l;++b)A+=ri[g[b]];return A}function Xr(g,u,l){const y=g.slice(u,l);let A="";for(let b=0;b<y.length-1;b+=2)A+=String.fromCharCode(y[b]+y[b+1]*256);return A}p.prototype.slice=function(u,l){const y=this.length;u=~~u,l=l===void 0?y:~~l,u<0?(u+=y,u<0&&(u=0)):u>y&&(u=y),l<0?(l+=y,l<0&&(l=0)):l>y&&(l=y),l<u&&(l=u);const A=this.subarray(u,l);return Object.setPrototypeOf(A,p.prototype),A};function le(g,u,l){if(g%1!==0||g<0)throw new RangeError("offset is not uint");if(g+u>l)throw new RangeError("Trying to access beyond buffer length")}p.prototype.readUintLE=p.prototype.readUIntLE=function(u,l,y){u=u>>>0,l=l>>>0,y||le(u,l,this.length);let A=this[u],b=1,D=0;for(;++D<l&&(b*=256);)A+=this[u+D]*b;return A},p.prototype.readUintBE=p.prototype.readUIntBE=function(u,l,y){u=u>>>0,l=l>>>0,y||le(u,l,this.length);let A=this[u+--l],b=1;for(;l>0&&(b*=256);)A+=this[u+--l]*b;return A},p.prototype.readUint8=p.prototype.readUInt8=function(u,l){return u=u>>>0,l||le(u,1,this.length),this[u]},p.prototype.readUint16LE=p.prototype.readUInt16LE=function(u,l){return u=u>>>0,l||le(u,2,this.length),this[u]|this[u+1]<<8},p.prototype.readUint16BE=p.prototype.readUInt16BE=function(u,l){return u=u>>>0,l||le(u,2,this.length),this[u]<<8|this[u+1]},p.prototype.readUint32LE=p.prototype.readUInt32LE=function(u,l){return u=u>>>0,l||le(u,4,this.length),(this[u]|this[u+1]<<8|this[u+2]<<16)+this[u+3]*16777216},p.prototype.readUint32BE=p.prototype.readUInt32BE=function(u,l){return u=u>>>0,l||le(u,4,this.length),this[u]*16777216+(this[u+1]<<16|this[u+2]<<8|this[u+3])},p.prototype.readBigUInt64LE=Ge(function(u){u=u>>>0,Ze(u,"offset");const l=this[u],y=this[u+7];(l===void 0||y===void 0)&&mt(u,this.length-8);const A=l+this[++u]*2**8+this[++u]*2**16+this[++u]*2**24,b=this[++u]+this[++u]*2**8+this[++u]*2**16+y*2**24;return BigInt(A)+(BigInt(b)<<BigInt(32))}),p.prototype.readBigUInt64BE=Ge(function(u){u=u>>>0,Ze(u,"offset");const l=this[u],y=this[u+7];(l===void 0||y===void 0)&&mt(u,this.length-8);const A=l*2**24+this[++u]*2**16+this[++u]*2**8+this[++u],b=this[++u]*2**24+this[++u]*2**16+this[++u]*2**8+y;return(BigInt(A)<<BigInt(32))+BigInt(b)}),p.prototype.readIntLE=function(u,l,y){u=u>>>0,l=l>>>0,y||le(u,l,this.length);let A=this[u],b=1,D=0;for(;++D<l&&(b*=256);)A+=this[u+D]*b;return b*=128,A>=b&&(A-=Math.pow(2,8*l)),A},p.prototype.readIntBE=function(u,l,y){u=u>>>0,l=l>>>0,y||le(u,l,this.length);let A=l,b=1,D=this[u+--A];for(;A>0&&(b*=256);)D+=this[u+--A]*b;return b*=128,D>=b&&(D-=Math.pow(2,8*l)),D},p.prototype.readInt8=function(u,l){return u=u>>>0,l||le(u,1,this.length),this[u]&128?(255-this[u]+1)*-1:this[u]},p.prototype.readInt16LE=function(u,l){u=u>>>0,l||le(u,2,this.length);const y=this[u]|this[u+1]<<8;return y&32768?y|4294901760:y},p.prototype.readInt16BE=function(u,l){u=u>>>0,l||le(u,2,this.length);const y=this[u+1]|this[u]<<8;return y&32768?y|4294901760:y},p.prototype.readInt32LE=function(u,l){return u=u>>>0,l||le(u,4,this.length),this[u]|this[u+1]<<8|this[u+2]<<16|this[u+3]<<24},p.prototype.readInt32BE=function(u,l){return u=u>>>0,l||le(u,4,this.length),this[u]<<24|this[u+1]<<16|this[u+2]<<8|this[u+3]},p.prototype.readBigInt64LE=Ge(function(u){u=u>>>0,Ze(u,"offset");const l=this[u],y=this[u+7];(l===void 0||y===void 0)&&mt(u,this.length-8);const A=this[u+4]+this[u+5]*2**8+this[u+6]*2**16+(y<<24);return(BigInt(A)<<BigInt(32))+BigInt(l+this[++u]*2**8+this[++u]*2**16+this[++u]*2**24)}),p.prototype.readBigInt64BE=Ge(function(u){u=u>>>0,Ze(u,"offset");const l=this[u],y=this[u+7];(l===void 0||y===void 0)&&mt(u,this.length-8);const A=(l<<24)+this[++u]*2**16+this[++u]*2**8+this[++u];return(BigInt(A)<<BigInt(32))+BigInt(this[++u]*2**24+this[++u]*2**16+this[++u]*2**8+y)}),p.prototype.readFloatLE=function(u,l){return u=u>>>0,l||le(u,4,this.length),t.read(this,u,!0,23,4)},p.prototype.readFloatBE=function(u,l){return u=u>>>0,l||le(u,4,this.length),t.read(this,u,!1,23,4)},p.prototype.readDoubleLE=function(u,l){return u=u>>>0,l||le(u,8,this.length),t.read(this,u,!0,52,8)},p.prototype.readDoubleBE=function(u,l){return u=u>>>0,l||le(u,8,this.length),t.read(this,u,!1,52,8)};function Se(g,u,l,y,A,b){if(!p.isBuffer(g))throw new TypeError('"buffer" argument must be a Buffer instance');if(u>A||u<b)throw new RangeError('"value" argument is out of bounds');if(l+y>g.length)throw new RangeError("Index out of range")}p.prototype.writeUintLE=p.prototype.writeUIntLE=function(u,l,y,A){if(u=+u,l=l>>>0,y=y>>>0,!A){const W=Math.pow(2,8*y)-1;Se(this,u,l,y,W,0)}let b=1,D=0;for(this[l]=u&255;++D<y&&(b*=256);)this[l+D]=u/b&255;return l+y},p.prototype.writeUintBE=p.prototype.writeUIntBE=function(u,l,y,A){if(u=+u,l=l>>>0,y=y>>>0,!A){const W=Math.pow(2,8*y)-1;Se(this,u,l,y,W,0)}let b=y-1,D=1;for(this[l+b]=u&255;--b>=0&&(D*=256);)this[l+b]=u/D&255;return l+y},p.prototype.writeUint8=p.prototype.writeUInt8=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,1,255,0),this[l]=u&255,l+1},p.prototype.writeUint16LE=p.prototype.writeUInt16LE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,2,65535,0),this[l]=u&255,this[l+1]=u>>>8,l+2},p.prototype.writeUint16BE=p.prototype.writeUInt16BE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,2,65535,0),this[l]=u>>>8,this[l+1]=u&255,l+2},p.prototype.writeUint32LE=p.prototype.writeUInt32LE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,4,4294967295,0),this[l+3]=u>>>24,this[l+2]=u>>>16,this[l+1]=u>>>8,this[l]=u&255,l+4},p.prototype.writeUint32BE=p.prototype.writeUInt32BE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,4,4294967295,0),this[l]=u>>>24,this[l+1]=u>>>16,this[l+2]=u>>>8,this[l+3]=u&255,l+4};function Tn(g,u,l,y,A){ti(u,y,A,g,l,7);let b=Number(u&BigInt(4294967295));g[l++]=b,b=b>>8,g[l++]=b,b=b>>8,g[l++]=b,b=b>>8,g[l++]=b;let D=Number(u>>BigInt(32)&BigInt(4294967295));return g[l++]=D,D=D>>8,g[l++]=D,D=D>>8,g[l++]=D,D=D>>8,g[l++]=D,l}function In(g,u,l,y,A){ti(u,y,A,g,l,7);let b=Number(u&BigInt(4294967295));g[l+7]=b,b=b>>8,g[l+6]=b,b=b>>8,g[l+5]=b,b=b>>8,g[l+4]=b;let D=Number(u>>BigInt(32)&BigInt(4294967295));return g[l+3]=D,D=D>>8,g[l+2]=D,D=D>>8,g[l+1]=D,D=D>>8,g[l]=D,l+8}p.prototype.writeBigUInt64LE=Ge(function(u,l=0){return Tn(this,u,l,BigInt(0),BigInt("0xffffffffffffffff"))}),p.prototype.writeBigUInt64BE=Ge(function(u,l=0){return In(this,u,l,BigInt(0),BigInt("0xffffffffffffffff"))}),p.prototype.writeIntLE=function(u,l,y,A){if(u=+u,l=l>>>0,!A){const ie=Math.pow(2,8*y-1);Se(this,u,l,y,ie-1,-ie)}let b=0,D=1,W=0;for(this[l]=u&255;++b<y&&(D*=256);)u<0&&W===0&&this[l+b-1]!==0&&(W=1),this[l+b]=(u/D>>0)-W&255;return l+y},p.prototype.writeIntBE=function(u,l,y,A){if(u=+u,l=l>>>0,!A){const ie=Math.pow(2,8*y-1);Se(this,u,l,y,ie-1,-ie)}let b=y-1,D=1,W=0;for(this[l+b]=u&255;--b>=0&&(D*=256);)u<0&&W===0&&this[l+b+1]!==0&&(W=1),this[l+b]=(u/D>>0)-W&255;return l+y},p.prototype.writeInt8=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,1,127,-128),u<0&&(u=255+u+1),this[l]=u&255,l+1},p.prototype.writeInt16LE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,2,32767,-32768),this[l]=u&255,this[l+1]=u>>>8,l+2},p.prototype.writeInt16BE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,2,32767,-32768),this[l]=u>>>8,this[l+1]=u&255,l+2},p.prototype.writeInt32LE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,4,2147483647,-2147483648),this[l]=u&255,this[l+1]=u>>>8,this[l+2]=u>>>16,this[l+3]=u>>>24,l+4},p.prototype.writeInt32BE=function(u,l,y){return u=+u,l=l>>>0,y||Se(this,u,l,4,2147483647,-2147483648),u<0&&(u=4294967295+u+1),this[l]=u>>>24,this[l+1]=u>>>16,this[l+2]=u>>>8,this[l+3]=u&255,l+4},p.prototype.writeBigInt64LE=Ge(function(u,l=0){return Tn(this,u,l,-BigInt("0x8000000000000000"),BigInt("0x7fffffffffffffff"))}),p.prototype.writeBigInt64BE=Ge(function(u,l=0){return In(this,u,l,-BigInt("0x8000000000000000"),BigInt("0x7fffffffffffffff"))});function wn(g,u,l,y,A,b){if(l+y>g.length)throw new RangeError("Index out of range");if(l<0)throw new RangeError("Index out of range")}function tr(g,u,l,y,A){return u=+u,l=l>>>0,A||wn(g,u,l,4),t.write(g,u,l,y,23,4),l+4}p.prototype.writeFloatLE=function(u,l,y){return tr(this,u,l,!0,y)},p.prototype.writeFloatBE=function(u,l,y){return tr(this,u,l,!1,y)};function Zr(g,u,l,y,A){return u=+u,l=l>>>0,A||wn(g,u,l,8),t.write(g,u,l,y,52,8),l+8}p.prototype.writeDoubleLE=function(u,l,y){return Zr(this,u,l,!0,y)},p.prototype.writeDoubleBE=function(u,l,y){return Zr(this,u,l,!1,y)},p.prototype.copy=function(u,l,y,A){if(!p.isBuffer(u))throw new TypeError("argument should be a Buffer");if(y||(y=0),!A&&A!==0&&(A=this.length),l>=u.length&&(l=u.length),l||(l=0),A>0&&A<y&&(A=y),A===y||u.length===0||this.length===0)return 0;if(l<0)throw new RangeError("targetStart out of bounds");if(y<0||y>=this.length)throw new RangeError("Index out of range");if(A<0)throw new RangeError("sourceEnd out of bounds");A>this.length&&(A=this.length),u.length-l<A-y&&(A=u.length-l+y);const b=A-y;return this===u&&typeof o.prototype.copyWithin=="function"?this.copyWithin(l,y,A):o.prototype.set.call(u,this.subarray(y,A),l),b},p.prototype.fill=function(u,l,y,A){if(typeof u=="string"){if(typeof l=="string"?(A=l,l=0,y=this.length):typeof y=="string"&&(A=y,y=this.length),A!==void 0&&typeof A!="string")throw new TypeError("encoding must be a string");if(typeof A=="string"&&!p.isEncoding(A))throw new TypeError("Unknown encoding: "+A);if(u.length===1){const D=u.charCodeAt(0);(A==="utf8"&&D<128||A==="latin1")&&(u=D)}}else typeof u=="number"?u=u&255:typeof u=="boolean"&&(u=Number(u));if(l<0||this.length<l||this.length<y)throw new RangeError("Out of range index");if(y<=l)return this;l=l>>>0,y=y===void 0?this.length:y>>>0,u||(u=0);let b;if(typeof u=="number")for(b=l;b<y;++b)this[b]=u;else{const D=p.isBuffer(u)?u:p.from(u,A),W=D.length;if(W===0)throw new TypeError('The value "'+u+'" is invalid for argument "value"');for(b=0;b<y-l;++b)this[b+l]=D[b%W]}return this};const Rt={};function vn(g,u,l){Rt[g]=class extends l{constructor(){super(),Object.defineProperty(this,"message",{value:u.apply(this,arguments),writable:!0,configurable:!0}),this.name=`${this.name} [${g}]`,this.stack,delete this.name}get code(){return g}set code(A){Object.defineProperty(this,"code",{configurable:!0,enumerable:!0,value:A,writable:!0})}toString(){return`${this.name} [${g}]: ${this.message}`}}}vn("ERR_BUFFER_OUT_OF_BOUNDS",function(g){return g?`${g} is outside of buffer bounds`:"Attempt to access memory outside buffer bounds"},RangeError),vn("ERR_INVALID_ARG_TYPE",function(g,u){return`The "${g}" argument must be of type number. Received type ${typeof u}`},TypeError),vn("ERR_OUT_OF_RANGE",function(g,u,l){let y=`The value of "${g}" is out of range.`,A=l;return Number.isInteger(l)&&Math.abs(l)>2**32?A=An(String(l)):typeof l=="bigint"&&(A=String(l),(l>BigInt(2)**BigInt(32)||l<-(BigInt(2)**BigInt(32)))&&(A=An(A)),A+="n"),y+=` It must be ${u}. Received ${A}`,y},RangeError);function An(g){let u="",l=g.length;const y=g[0]==="-"?1:0;for(;l>=y+4;l-=3)u=`_${g.slice(l-3,l)}${u}`;return`${g.slice(0,l)}${u}`}function ei(g,u,l){Ze(u,"offset"),(g[u]===void 0||g[u+l]===void 0)&&mt(u,g.length-(l+1))}function ti(g,u,l,y,A,b){if(g>l||g<u){const D=typeof u=="bigint"?"n":"";let W;throw u===0||u===BigInt(0)?W=`>= 0${D} and < 2${D} ** ${(b+1)*8}${D}`:W=`>= -(2${D} ** ${(b+1)*8-1}${D}) and < 2 ** ${(b+1)*8-1}${D}`,new Rt.ERR_OUT_OF_RANGE("value",W,g)}ei(y,A,b)}function Ze(g,u){if(typeof g!="number")throw new Rt.ERR_INVALID_ARG_TYPE(u,"number",g)}function mt(g,u,l){throw Math.floor(g)!==g?(Ze(g,l),new Rt.ERR_OUT_OF_RANGE("offset","an integer",g)):u<0?new Rt.ERR_BUFFER_OUT_OF_BOUNDS:new Rt.ERR_OUT_OF_RANGE("offset",`>= 0 and <= ${u}`,g)}const ni=/[^+/0-9A-Za-z-_]/g;function Pe(g){if(g=g.split("=")[0],g=g.trim().replace(ni,""),g.length<2)return"";for(;g.length%4!==0;)g=g+"=";return g}function Ee(g,u){u=u||1/0;let l;const y=g.length;let A=null;const b=[];for(let D=0;D<y;++D){if(l=g.charCodeAt(D),l>55295&&l<57344){if(!A){if(l>56319){(u-=3)>-1&&b.push(239,191,189);continue}else if(D+1===y){(u-=3)>-1&&b.push(239,191,189);continue}A=l;continue}if(l<56320){(u-=3)>-1&&b.push(239,191,189),A=l;continue}l=(A-55296<<10|l-56320)+65536}else A&&(u-=3)>-1&&b.push(239,191,189);if(A=null,l<128){if((u-=1)<0)break;b.push(l)}else if(l<2048){if((u-=2)<0)break;b.push(l>>6|192,l&63|128)}else if(l<65536){if((u-=3)<0)break;b.push(l>>12|224,l>>6&63|128,l&63|128)}else if(l<1114112){if((u-=4)<0)break;b.push(l>>18|240,l>>12&63|128,l>>6&63|128,l&63|128)}else throw new Error("Invalid code point")}return b}function Rn(g){const u=[];for(let l=0;l<g.length;++l)u.push(g.charCodeAt(l)&255);return u}function Es(g,u){let l,y,A;const b=[];for(let D=0;D<g.length&&!((u-=2)<0);++D)l=g.charCodeAt(D),y=l>>8,A=l%256,b.push(A),b.push(y);return b}function nr(g){return e.toByteArray(Pe(g))}function Sn(g,u,l,y){let A;for(A=0;A<y&&!(A+l>=u.length||A>=g.length);++A)u[A+l]=g[A];return A}function Oe(g,u){return g instanceof u||g!=null&&g.constructor!=null&&g.constructor.name!=null&&g.constructor.name===u.name}function Pn(g){return g!==g}const ri=function(){const g="0123456789abcdef",u=new Array(256);for(let l=0;l<16;++l){const y=l*16;for(let A=0;A<16;++A)u[y+A]=g[l]+g[A]}return u}();function Ge(g){return typeof BigInt>"u"?Ts:g}function Ts(){throw new Error("BigInt not supported")}})(Ae);const pl=Ae.Buffer,og=Ae.Blob,ag=Ae.BlobOptions,cg=Ae.Buffer,ug=Ae.File,lg=Ae.FileOptions,hg=Ae.INSPECT_MAX_BYTES,dg=Ae.SlowBuffer,fg=Ae.TranscodeEncoding,pg=Ae.atob,mg=Ae.btoa,gg=Ae.constants,_g=Ae.isAscii,yg=Ae.isUtf8,Eg=Ae.kMaxLength,Tg=Ae.kStringMaxLength,Ig=Ae.resolveObjectURL,wg=Ae.transcode,XE=Object.freeze(Object.defineProperty({__proto__:null,Blob:og,BlobOptions:ag,Buffer:cg,File:ug,FileOptions:lg,INSPECT_MAX_BYTES:hg,SlowBuffer:dg,TranscodeEncoding:fg,atob:pg,btoa:mg,constants:gg,default:pl,isAscii:_g,isUtf8:yg,kMaxLength:Eg,kStringMaxLength:Tg,resolveObjectURL:Ig,transcode:wg},Symbol.toStringTag,{value:"Module"}));var Sc=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof un<"u"?un:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var jt,ml;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(R,E){function I(){}I.prototype=E.prototype,R.F=E.prototype,R.prototype=new I,R.prototype.constructor=R,R.D=function(S,v,C){for(var T=Array(arguments.length-2),xe=2;xe<arguments.length;xe++)T[xe-2]=arguments[xe];return E.prototype[v].apply(S,T)}}function t(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}e(r,t),r.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(R,E,I){I||(I=0);const S=Array(16);if(typeof E=="string")for(var v=0;v<16;++v)S[v]=E.charCodeAt(I++)|E.charCodeAt(I++)<<8|E.charCodeAt(I++)<<16|E.charCodeAt(I++)<<24;else for(v=0;v<16;++v)S[v]=E[I++]|E[I++]<<8|E[I++]<<16|E[I++]<<24;E=R.g[0],I=R.g[1],v=R.g[2];let C=R.g[3],T;T=E+(C^I&(v^C))+S[0]+3614090360&4294967295,E=I+(T<<7&4294967295|T>>>25),T=C+(v^E&(I^v))+S[1]+3905402710&4294967295,C=E+(T<<12&4294967295|T>>>20),T=v+(I^C&(E^I))+S[2]+606105819&4294967295,v=C+(T<<17&4294967295|T>>>15),T=I+(E^v&(C^E))+S[3]+3250441966&4294967295,I=v+(T<<22&4294967295|T>>>10),T=E+(C^I&(v^C))+S[4]+4118548399&4294967295,E=I+(T<<7&4294967295|T>>>25),T=C+(v^E&(I^v))+S[5]+1200080426&4294967295,C=E+(T<<12&4294967295|T>>>20),T=v+(I^C&(E^I))+S[6]+2821735955&4294967295,v=C+(T<<17&4294967295|T>>>15),T=I+(E^v&(C^E))+S[7]+4249261313&4294967295,I=v+(T<<22&4294967295|T>>>10),T=E+(C^I&(v^C))+S[8]+1770035416&4294967295,E=I+(T<<7&4294967295|T>>>25),T=C+(v^E&(I^v))+S[9]+2336552879&4294967295,C=E+(T<<12&4294967295|T>>>20),T=v+(I^C&(E^I))+S[10]+4294925233&4294967295,v=C+(T<<17&4294967295|T>>>15),T=I+(E^v&(C^E))+S[11]+2304563134&4294967295,I=v+(T<<22&4294967295|T>>>10),T=E+(C^I&(v^C))+S[12]+1804603682&4294967295,E=I+(T<<7&4294967295|T>>>25),T=C+(v^E&(I^v))+S[13]+4254626195&4294967295,C=E+(T<<12&4294967295|T>>>20),T=v+(I^C&(E^I))+S[14]+2792965006&4294967295,v=C+(T<<17&4294967295|T>>>15),T=I+(E^v&(C^E))+S[15]+1236535329&4294967295,I=v+(T<<22&4294967295|T>>>10),T=E+(v^C&(I^v))+S[1]+4129170786&4294967295,E=I+(T<<5&4294967295|T>>>27),T=C+(I^v&(E^I))+S[6]+3225465664&4294967295,C=E+(T<<9&4294967295|T>>>23),T=v+(E^I&(C^E))+S[11]+643717713&4294967295,v=C+(T<<14&4294967295|T>>>18),T=I+(C^E&(v^C))+S[0]+3921069994&4294967295,I=v+(T<<20&4294967295|T>>>12),T=E+(v^C&(I^v))+S[5]+3593408605&4294967295,E=I+(T<<5&4294967295|T>>>27),T=C+(I^v&(E^I))+S[10]+38016083&4294967295,C=E+(T<<9&4294967295|T>>>23),T=v+(E^I&(C^E))+S[15]+3634488961&4294967295,v=C+(T<<14&4294967295|T>>>18),T=I+(C^E&(v^C))+S[4]+3889429448&4294967295,I=v+(T<<20&4294967295|T>>>12),T=E+(v^C&(I^v))+S[9]+568446438&4294967295,E=I+(T<<5&4294967295|T>>>27),T=C+(I^v&(E^I))+S[14]+3275163606&4294967295,C=E+(T<<9&4294967295|T>>>23),T=v+(E^I&(C^E))+S[3]+4107603335&4294967295,v=C+(T<<14&4294967295|T>>>18),T=I+(C^E&(v^C))+S[8]+1163531501&4294967295,I=v+(T<<20&4294967295|T>>>12),T=E+(v^C&(I^v))+S[13]+2850285829&4294967295,E=I+(T<<5&4294967295|T>>>27),T=C+(I^v&(E^I))+S[2]+4243563512&4294967295,C=E+(T<<9&4294967295|T>>>23),T=v+(E^I&(C^E))+S[7]+1735328473&4294967295,v=C+(T<<14&4294967295|T>>>18),T=I+(C^E&(v^C))+S[12]+2368359562&4294967295,I=v+(T<<20&4294967295|T>>>12),T=E+(I^v^C)+S[5]+4294588738&4294967295,E=I+(T<<4&4294967295|T>>>28),T=C+(E^I^v)+S[8]+2272392833&4294967295,C=E+(T<<11&4294967295|T>>>21),T=v+(C^E^I)+S[11]+1839030562&4294967295,v=C+(T<<16&4294967295|T>>>16),T=I+(v^C^E)+S[14]+4259657740&4294967295,I=v+(T<<23&4294967295|T>>>9),T=E+(I^v^C)+S[1]+2763975236&4294967295,E=I+(T<<4&4294967295|T>>>28),T=C+(E^I^v)+S[4]+1272893353&4294967295,C=E+(T<<11&4294967295|T>>>21),T=v+(C^E^I)+S[7]+4139469664&4294967295,v=C+(T<<16&4294967295|T>>>16),T=I+(v^C^E)+S[10]+3200236656&4294967295,I=v+(T<<23&4294967295|T>>>9),T=E+(I^v^C)+S[13]+681279174&4294967295,E=I+(T<<4&4294967295|T>>>28),T=C+(E^I^v)+S[0]+3936430074&4294967295,C=E+(T<<11&4294967295|T>>>21),T=v+(C^E^I)+S[3]+3572445317&4294967295,v=C+(T<<16&4294967295|T>>>16),T=I+(v^C^E)+S[6]+76029189&4294967295,I=v+(T<<23&4294967295|T>>>9),T=E+(I^v^C)+S[9]+3654602809&4294967295,E=I+(T<<4&4294967295|T>>>28),T=C+(E^I^v)+S[12]+3873151461&4294967295,C=E+(T<<11&4294967295|T>>>21),T=v+(C^E^I)+S[15]+530742520&4294967295,v=C+(T<<16&4294967295|T>>>16),T=I+(v^C^E)+S[2]+3299628645&4294967295,I=v+(T<<23&4294967295|T>>>9),T=E+(v^(I|~C))+S[0]+4096336452&4294967295,E=I+(T<<6&4294967295|T>>>26),T=C+(I^(E|~v))+S[7]+1126891415&4294967295,C=E+(T<<10&4294967295|T>>>22),T=v+(E^(C|~I))+S[14]+2878612391&4294967295,v=C+(T<<15&4294967295|T>>>17),T=I+(C^(v|~E))+S[5]+4237533241&4294967295,I=v+(T<<21&4294967295|T>>>11),T=E+(v^(I|~C))+S[12]+1700485571&4294967295,E=I+(T<<6&4294967295|T>>>26),T=C+(I^(E|~v))+S[3]+2399980690&4294967295,C=E+(T<<10&4294967295|T>>>22),T=v+(E^(C|~I))+S[10]+4293915773&4294967295,v=C+(T<<15&4294967295|T>>>17),T=I+(C^(v|~E))+S[1]+2240044497&4294967295,I=v+(T<<21&4294967295|T>>>11),T=E+(v^(I|~C))+S[8]+1873313359&4294967295,E=I+(T<<6&4294967295|T>>>26),T=C+(I^(E|~v))+S[15]+4264355552&4294967295,C=E+(T<<10&4294967295|T>>>22),T=v+(E^(C|~I))+S[6]+2734768916&4294967295,v=C+(T<<15&4294967295|T>>>17),T=I+(C^(v|~E))+S[13]+1309151649&4294967295,I=v+(T<<21&4294967295|T>>>11),T=E+(v^(I|~C))+S[4]+4149444226&4294967295,E=I+(T<<6&4294967295|T>>>26),T=C+(I^(E|~v))+S[11]+3174756917&4294967295,C=E+(T<<10&4294967295|T>>>22),T=v+(E^(C|~I))+S[2]+718787259&4294967295,v=C+(T<<15&4294967295|T>>>17),T=I+(C^(v|~E))+S[9]+3951481745&4294967295,R.g[0]=R.g[0]+E&4294967295,R.g[1]=R.g[1]+(v+(T<<21&4294967295|T>>>11))&4294967295,R.g[2]=R.g[2]+v&4294967295,R.g[3]=R.g[3]+C&4294967295}r.prototype.v=function(R,E){E===void 0&&(E=R.length);const I=E-this.blockSize,S=this.C;let v=this.h,C=0;for(;C<E;){if(v==0)for(;C<=I;)i(this,R,C),C+=this.blockSize;if(typeof R=="string"){for(;C<E;)if(S[v++]=R.charCodeAt(C++),v==this.blockSize){i(this,S),v=0;break}}else for(;C<E;)if(S[v++]=R[C++],v==this.blockSize){i(this,S),v=0;break}}this.h=v,this.o+=E},r.prototype.A=function(){var R=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);R[0]=128;for(var E=1;E<R.length-8;++E)R[E]=0;E=this.o*8;for(var I=R.length-8;I<R.length;++I)R[I]=E&255,E/=256;for(this.v(R),R=Array(16),E=0,I=0;I<4;++I)for(let S=0;S<32;S+=8)R[E++]=this.g[I]>>>S&255;return R};function o(R,E){var I=h;return Object.prototype.hasOwnProperty.call(I,R)?I[R]:I[R]=E(R)}function a(R,E){this.h=E;const I=[];let S=!0;for(let v=R.length-1;v>=0;v--){const C=R[v]|0;S&&C==E||(I[v]=C,S=!1)}this.g=I}var h={};function f(R){return-128<=R&&R<128?o(R,function(E){return new a([E|0],E<0?-1:0)}):new a([R|0],R<0?-1:0)}function m(R){if(isNaN(R)||!isFinite(R))return w;if(R<0)return U(m(-R));const E=[];let I=1;for(let S=0;R>=I;S++)E[S]=R/I|0,I*=4294967296;return new a(E,0)}function p(R,E){if(R.length==0)throw Error("number format error: empty string");if(E=E||10,E<2||36<E)throw Error("radix out of range: "+E);if(R.charAt(0)=="-")return U(p(R.substring(1),E));if(R.indexOf("-")>=0)throw Error('number format error: interior "-" character');const I=m(Math.pow(E,8));let S=w;for(let C=0;C<R.length;C+=8){var v=Math.min(8,R.length-C);const T=parseInt(R.substring(C,C+v),E);v<8?(v=m(Math.pow(E,v)),S=S.j(v).add(m(T))):(S=S.j(I),S=S.add(m(T)))}return S}var w=f(0),k=f(1),N=f(16777216);n=a.prototype,n.m=function(){if(j(this))return-U(this).m();let R=0,E=1;for(let I=0;I<this.g.length;I++){const S=this.i(I);R+=(S>=0?S:4294967296+S)*E,E*=4294967296}return R},n.toString=function(R){if(R=R||10,R<2||36<R)throw Error("radix out of range: "+R);if(L(this))return"0";if(j(this))return"-"+U(this).toString(R);const E=m(Math.pow(R,6));var I=this;let S="";for(;;){const v=Ne(I,E).g;I=ee(I,v.j(E));let C=((I.g.length>0?I.g[0]:I.h)>>>0).toString(R);if(I=v,L(I))return C+S;for(;C.length<6;)C="0"+C;S=C+S}},n.i=function(R){return R<0?0:R<this.g.length?this.g[R]:this.h};function L(R){if(R.h!=0)return!1;for(let E=0;E<R.g.length;E++)if(R.g[E]!=0)return!1;return!0}function j(R){return R.h==-1}n.l=function(R){return R=ee(this,R),j(R)?-1:L(R)?0:1};function U(R){const E=R.g.length,I=[];for(let S=0;S<E;S++)I[S]=~R.g[S];return new a(I,~R.h).add(k)}n.abs=function(){return j(this)?U(this):this},n.add=function(R){const E=Math.max(this.g.length,R.g.length),I=[];let S=0;for(let v=0;v<=E;v++){let C=S+(this.i(v)&65535)+(R.i(v)&65535),T=(C>>>16)+(this.i(v)>>>16)+(R.i(v)>>>16);S=T>>>16,C&=65535,T&=65535,I[v]=T<<16|C}return new a(I,I[I.length-1]&-2147483648?-1:0)};function ee(R,E){return R.add(U(E))}n.j=function(R){if(L(this)||L(R))return w;if(j(this))return j(R)?U(this).j(U(R)):U(U(this).j(R));if(j(R))return U(this.j(U(R)));if(this.l(N)<0&&R.l(N)<0)return m(this.m()*R.m());const E=this.g.length+R.g.length,I=[];for(var S=0;S<2*E;S++)I[S]=0;for(S=0;S<this.g.length;S++)for(let v=0;v<R.g.length;v++){const C=this.i(S)>>>16,T=this.i(S)&65535,xe=R.i(v)>>>16,pt=R.i(v)&65535;I[2*S+2*v]+=T*pt,Z(I,2*S+2*v),I[2*S+2*v+1]+=C*pt,Z(I,2*S+2*v+1),I[2*S+2*v+1]+=T*xe,Z(I,2*S+2*v+1),I[2*S+2*v+2]+=C*xe,Z(I,2*S+2*v+2)}for(R=0;R<E;R++)I[R]=I[2*R+1]<<16|I[2*R];for(R=E;R<2*E;R++)I[R]=0;return new a(I,0)};function Z(R,E){for(;(R[E]&65535)!=R[E];)R[E+1]+=R[E]>>>16,R[E]&=65535,E++}function ue(R,E){this.g=R,this.h=E}function Ne(R,E){if(L(E))throw Error("division by zero");if(L(R))return new ue(w,w);if(j(R))return E=Ne(U(R),E),new ue(U(E.g),U(E.h));if(j(E))return E=Ne(R,U(E)),new ue(U(E.g),E.h);if(R.g.length>30){if(j(R)||j(E))throw Error("slowDivide_ only works with positive integers.");for(var I=k,S=E;S.l(R)<=0;)I=Re(I),S=Re(S);var v=ye(I,1),C=ye(S,1);for(S=ye(S,2),I=ye(I,2);!L(S);){var T=C.add(S);T.l(R)<=0&&(v=v.add(I),C=T),S=ye(S,1),I=ye(I,1)}return E=ee(R,v.j(E)),new ue(v,E)}for(v=w;R.l(E)>=0;){for(I=Math.max(1,Math.floor(R.m()/E.m())),S=Math.ceil(Math.log(I)/Math.LN2),S=S<=48?1:Math.pow(2,S-48),C=m(I),T=C.j(E);j(T)||T.l(R)>0;)I-=S,C=m(I),T=C.j(E);L(C)&&(C=k),v=v.add(C),R=ee(R,T)}return new ue(v,R)}n.B=function(R){return Ne(this,R).h},n.and=function(R){const E=Math.max(this.g.length,R.g.length),I=[];for(let S=0;S<E;S++)I[S]=this.i(S)&R.i(S);return new a(I,this.h&R.h)},n.or=function(R){const E=Math.max(this.g.length,R.g.length),I=[];for(let S=0;S<E;S++)I[S]=this.i(S)|R.i(S);return new a(I,this.h|R.h)},n.xor=function(R){const E=Math.max(this.g.length,R.g.length),I=[];for(let S=0;S<E;S++)I[S]=this.i(S)^R.i(S);return new a(I,this.h^R.h)};function Re(R){const E=R.g.length+1,I=[];for(let S=0;S<E;S++)I[S]=R.i(S)<<1|R.i(S-1)>>>31;return new a(I,R.h)}function ye(R,E){const I=E>>5;E%=32;const S=R.g.length-I,v=[];for(let C=0;C<S;C++)v[C]=E>0?R.i(C+I)>>>E|R.i(C+I+1)<<32-E:R.i(C+I);return new a(v,R.h)}r.prototype.digest=r.prototype.A,r.prototype.reset=r.prototype.u,r.prototype.update=r.prototype.v,ml=r,a.prototype.add=a.prototype.add,a.prototype.multiply=a.prototype.j,a.prototype.modulo=a.prototype.B,a.prototype.compare=a.prototype.l,a.prototype.toNumber=a.prototype.m,a.prototype.toString=a.prototype.toString,a.prototype.getBits=a.prototype.i,a.fromNumber=m,a.fromString=p,jt=a}).apply(typeof Sc<"u"?Sc:typeof self<"u"?self:typeof window<"u"?window:{});var mi=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof un<"u"?un:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var gl,_r,_l,Ri,io,yl,El,Tl;(function(){var n,e=Object.defineProperty;function t(s){s=[typeof globalThis=="object"&&globalThis,s,typeof window=="object"&&window,typeof self=="object"&&self,typeof mi=="object"&&mi];for(var c=0;c<s.length;++c){var d=s[c];if(d&&d.Math==Math)return d}throw Error("Cannot find global object")}var r=t(this);function i(s,c){if(c)e:{var d=r;s=s.split(".");for(var _=0;_<s.length-1;_++){var P=s[_];if(!(P in d))break e;d=d[P]}s=s[s.length-1],_=d[s],c=c(_),c!=_&&c!=null&&e(d,s,{configurable:!0,writable:!0,value:c})}}i("Symbol.dispose",function(s){return s||Symbol("Symbol.dispose")}),i("Array.prototype.values",function(s){return s||function(){return this[Symbol.iterator]()}}),i("Object.entries",function(s){return s||function(c){var d=[],_;for(_ in c)Object.prototype.hasOwnProperty.call(c,_)&&d.push([_,c[_]]);return d}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var o=o||{},a=this||self;function h(s){var c=typeof s;return c=="object"&&s!=null||c=="function"}function f(s,c,d){return s.call.apply(s.bind,arguments)}function m(s,c,d){return m=f,m.apply(null,arguments)}function p(s,c){var d=Array.prototype.slice.call(arguments,1);return function(){var _=d.slice();return _.push.apply(_,arguments),s.apply(this,_)}}function w(s,c){function d(){}d.prototype=c.prototype,s.Z=c.prototype,s.prototype=new d,s.prototype.constructor=s,s.Ob=function(_,P,V){for(var M=Array(arguments.length-2),K=2;K<arguments.length;K++)M[K-2]=arguments[K];return c.prototype[P].apply(_,M)}}var k=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?s=>s&&AsyncContext.Snapshot.wrap(s):s=>s;function N(s){const c=s.length;if(c>0){const d=Array(c);for(let _=0;_<c;_++)d[_]=s[_];return d}return[]}function L(s,c){for(let _=1;_<arguments.length;_++){const P=arguments[_];var d=typeof P;if(d=d!="object"?d:P?Array.isArray(P)?"array":d:"null",d=="array"||d=="object"&&typeof P.length=="number"){d=s.length||0;const V=P.length||0;s.length=d+V;for(let M=0;M<V;M++)s[d+M]=P[M]}else s.push(P)}}class j{constructor(c,d){this.i=c,this.j=d,this.h=0,this.g=null}get(){let c;return this.h>0?(this.h--,c=this.g,this.g=c.next,c.next=null):c=this.i(),c}}function U(s){a.setTimeout(()=>{throw s},0)}function ee(){var s=R;let c=null;return s.g&&(c=s.g,s.g=s.g.next,s.g||(s.h=null),c.next=null),c}class Z{constructor(){this.h=this.g=null}add(c,d){const _=ue.get();_.set(c,d),this.h?this.h.next=_:this.g=_,this.h=_}}var ue=new j(()=>new Ne,s=>s.reset());class Ne{constructor(){this.next=this.g=this.h=null}set(c,d){this.h=c,this.g=d,this.next=null}reset(){this.next=this.g=this.h=null}}let Re,ye=!1,R=new Z,E=()=>{const s=Promise.resolve(void 0);Re=()=>{s.then(I)}};function I(){for(var s;s=ee();){try{s.h.call(s.g)}catch(d){U(d)}var c=ue;c.j(s),c.h<100&&(c.h++,s.next=c.g,c.g=s)}ye=!1}function S(){this.u=this.u,this.C=this.C}S.prototype.u=!1,S.prototype.dispose=function(){this.u||(this.u=!0,this.N())},S.prototype[Symbol.dispose]=function(){this.dispose()},S.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function v(s,c){this.type=s,this.g=this.target=c,this.defaultPrevented=!1}v.prototype.h=function(){this.defaultPrevented=!0};var C=function(){if(!a.addEventListener||!Object.defineProperty)return!1;var s=!1,c=Object.defineProperty({},"passive",{get:function(){s=!0}});try{const d=()=>{};a.addEventListener("test",d,c),a.removeEventListener("test",d,c)}catch{}return s}();function T(s){return/^[\s\xa0]*$/.test(s)}function xe(s,c){v.call(this,s?s.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,s&&this.init(s,c)}w(xe,v),xe.prototype.init=function(s,c){const d=this.type=s.type,_=s.changedTouches&&s.changedTouches.length?s.changedTouches[0]:null;this.target=s.target||s.srcElement,this.g=c,c=s.relatedTarget,c||(d=="mouseover"?c=s.fromElement:d=="mouseout"&&(c=s.toElement)),this.relatedTarget=c,_?(this.clientX=_.clientX!==void 0?_.clientX:_.pageX,this.clientY=_.clientY!==void 0?_.clientY:_.pageY,this.screenX=_.screenX||0,this.screenY=_.screenY||0):(this.clientX=s.clientX!==void 0?s.clientX:s.pageX,this.clientY=s.clientY!==void 0?s.clientY:s.pageY,this.screenX=s.screenX||0,this.screenY=s.screenY||0),this.button=s.button,this.key=s.key||"",this.ctrlKey=s.ctrlKey,this.altKey=s.altKey,this.shiftKey=s.shiftKey,this.metaKey=s.metaKey,this.pointerId=s.pointerId||0,this.pointerType=s.pointerType,this.state=s.state,this.i=s,s.defaultPrevented&&xe.Z.h.call(this)},xe.prototype.h=function(){xe.Z.h.call(this);const s=this.i;s.preventDefault?s.preventDefault():s.returnValue=!1};var pt="closure_listenable_"+(Math.random()*1e6|0),_s=0;function Qr(s,c,d,_,P){this.listener=s,this.proxy=null,this.src=c,this.type=d,this.capture=!!_,this.ha=P,this.key=++_s,this.da=this.fa=!1}function Yt(s){s.da=!0,s.listener=null,s.proxy=null,s.src=null,s.ha=null}function En(s,c,d){for(const _ in s)c.call(d,s[_],_,s)}function ys(s,c){for(const d in s)c.call(void 0,s[d],d,s)}function Jr(s){const c={};for(const d in s)c[d]=s[d];return c}const Yr="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Xr(s,c){let d,_;for(let P=1;P<arguments.length;P++){_=arguments[P];for(d in _)s[d]=_[d];for(let V=0;V<Yr.length;V++)d=Yr[V],Object.prototype.hasOwnProperty.call(_,d)&&(s[d]=_[d])}}function le(s){this.src=s,this.g={},this.h=0}le.prototype.add=function(s,c,d,_,P){const V=s.toString();s=this.g[V],s||(s=this.g[V]=[],this.h++);const M=Tn(s,c,_,P);return M>-1?(c=s[M],d||(c.fa=!1)):(c=new Qr(c,this.src,V,!!_,P),c.fa=d,s.push(c)),c};function Se(s,c){const d=c.type;if(d in s.g){var _=s.g[d],P=Array.prototype.indexOf.call(_,c,void 0),V;(V=P>=0)&&Array.prototype.splice.call(_,P,1),V&&(Yt(c),s.g[d].length==0&&(delete s.g[d],s.h--))}}function Tn(s,c,d,_){for(let P=0;P<s.length;++P){const V=s[P];if(!V.da&&V.listener==c&&V.capture==!!d&&V.ha==_)return P}return-1}var In="closure_lm_"+(Math.random()*1e6|0),wn={};function tr(s,c,d,_,P){if(Array.isArray(c)){for(let V=0;V<c.length;V++)tr(s,c[V],d,_,P);return null}return d=ni(d),s&&s[pt]?s.J(c,d,h(_)?!!_.capture:!1,P):Zr(s,c,d,!1,_,P)}function Zr(s,c,d,_,P,V){if(!c)throw Error("Invalid event type");const M=h(P)?!!P.capture:!!P;let K=Ze(s);if(K||(s[In]=K=new le(s)),d=K.add(c,d,_,M,V),d.proxy)return d;if(_=Rt(),d.proxy=_,_.src=s,_.listener=d,s.addEventListener)C||(P=M),P===void 0&&(P=!1),s.addEventListener(c.toString(),_,P);else if(s.attachEvent)s.attachEvent(ei(c.toString()),_);else if(s.addListener&&s.removeListener)s.addListener(_);else throw Error("addEventListener and attachEvent are unavailable.");return d}function Rt(){function s(d){return c.call(s.src,s.listener,d)}const c=ti;return s}function vn(s,c,d,_,P){if(Array.isArray(c))for(var V=0;V<c.length;V++)vn(s,c[V],d,_,P);else _=h(_)?!!_.capture:!!_,d=ni(d),s&&s[pt]?(s=s.i,V=String(c).toString(),V in s.g&&(c=s.g[V],d=Tn(c,d,_,P),d>-1&&(Yt(c[d]),Array.prototype.splice.call(c,d,1),c.length==0&&(delete s.g[V],s.h--)))):s&&(s=Ze(s))&&(c=s.g[c.toString()],s=-1,c&&(s=Tn(c,d,_,P)),(d=s>-1?c[s]:null)&&An(d))}function An(s){if(typeof s!="number"&&s&&!s.da){var c=s.src;if(c&&c[pt])Se(c.i,s);else{var d=s.type,_=s.proxy;c.removeEventListener?c.removeEventListener(d,_,s.capture):c.detachEvent?c.detachEvent(ei(d),_):c.addListener&&c.removeListener&&c.removeListener(_),(d=Ze(c))?(Se(d,s),d.h==0&&(d.src=null,c[In]=null)):Yt(s)}}}function ei(s){return s in wn?wn[s]:wn[s]="on"+s}function ti(s,c){if(s.da)s=!0;else{c=new xe(c,this);const d=s.listener,_=s.ha||s.src;s.fa&&An(s),s=d.call(_,c)}return s}function Ze(s){return s=s[In],s instanceof le?s:null}var mt="__closure_events_fn_"+(Math.random()*1e9>>>0);function ni(s){return typeof s=="function"?s:(s[mt]||(s[mt]=function(c){return s.handleEvent(c)}),s[mt])}function Pe(){S.call(this),this.i=new le(this),this.M=this,this.G=null}w(Pe,S),Pe.prototype[pt]=!0,Pe.prototype.removeEventListener=function(s,c,d,_){vn(this,s,c,d,_)};function Ee(s,c){var d,_=s.G;if(_)for(d=[];_;_=_.G)d.push(_);if(s=s.M,_=c.type||c,typeof c=="string")c=new v(c,s);else if(c instanceof v)c.target=c.target||s;else{var P=c;c=new v(_,s),Xr(c,P)}P=!0;let V,M;if(d)for(M=d.length-1;M>=0;M--)V=c.g=d[M],P=Rn(V,_,!0,c)&&P;if(V=c.g=s,P=Rn(V,_,!0,c)&&P,P=Rn(V,_,!1,c)&&P,d)for(M=0;M<d.length;M++)V=c.g=d[M],P=Rn(V,_,!1,c)&&P}Pe.prototype.N=function(){if(Pe.Z.N.call(this),this.i){var s=this.i;for(const c in s.g){const d=s.g[c];for(let _=0;_<d.length;_++)Yt(d[_]);delete s.g[c],s.h--}}this.G=null},Pe.prototype.J=function(s,c,d,_){return this.i.add(String(s),c,!1,d,_)},Pe.prototype.K=function(s,c,d,_){return this.i.add(String(s),c,!0,d,_)};function Rn(s,c,d,_){if(c=s.i.g[String(c)],!c)return!0;c=c.concat();let P=!0;for(let V=0;V<c.length;++V){const M=c[V];if(M&&!M.da&&M.capture==d){const K=M.listener,Te=M.ha||M.src;M.fa&&Se(s.i,M),P=K.call(Te,_)!==!1&&P}}return P&&!_.defaultPrevented}function Es(s,c){if(typeof s!="function")if(s&&typeof s.handleEvent=="function")s=m(s.handleEvent,s);else throw Error("Invalid listener argument");return Number(c)>2147483647?-1:a.setTimeout(s,c||0)}function nr(s){s.g=Es(()=>{s.g=null,s.i&&(s.i=!1,nr(s))},s.l);const c=s.h;s.h=null,s.m.apply(null,c)}class Sn extends S{constructor(c,d){super(),this.m=c,this.l=d,this.h=null,this.i=!1,this.g=null}j(c){this.h=arguments,this.g?this.i=!0:nr(this)}N(){super.N(),this.g&&(a.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Oe(s){S.call(this),this.h=s,this.g={}}w(Oe,S);var Pn=[];function ri(s){En(s.g,function(c,d){this.g.hasOwnProperty(d)&&An(c)},s),s.g={}}Oe.prototype.N=function(){Oe.Z.N.call(this),ri(this)},Oe.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Ge=a.JSON.stringify,Ts=a.JSON.parse,g=class{stringify(s){return a.JSON.stringify(s,void 0)}parse(s){return a.JSON.parse(s,void 0)}};function u(){}function l(){}var y={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function A(){v.call(this,"d")}w(A,v);function b(){v.call(this,"c")}w(b,v);var D={},W=null;function ie(){return W=W||new Pe}D.Ia="serverreachability";function se(s){v.call(this,D.Ia,s)}w(se,v);function re(s){const c=ie();Ee(c,new se(c))}D.STAT_EVENT="statevent";function te(s,c){v.call(this,D.STAT_EVENT,s),this.stat=c}w(te,v);function Be(s){const c=ie();Ee(c,new te(c,s))}D.Ja="timingevent";function fa(s,c){v.call(this,D.Ja,s),this.size=c}w(fa,v);function rr(s,c){if(typeof s!="function")throw Error("Fn must not be null and must be a function");return a.setTimeout(function(){s()},c)}function ir(){this.g=!0}ir.prototype.ua=function(){this.g=!1};function qh(s,c,d,_,P,V){s.info(function(){if(s.g)if(V){var M="",K=V.split("&");for(let oe=0;oe<K.length;oe++){var Te=K[oe].split("=");if(Te.length>1){const Ce=Te[0];Te=Te[1];const tt=Ce.split("_");M=tt.length>=2&&tt[1]=="type"?M+(Ce+"="+Te+"&"):M+(Ce+"=redacted&")}}}else M=null;else M=V;return"XMLHTTP REQ ("+_+") [attempt "+P+"]: "+c+`
`+d+`
`+M})}function zh(s,c,d,_,P,V,M){s.info(function(){return"XMLHTTP RESP ("+_+") [ attempt "+P+"]: "+c+`
`+d+`
`+V+" "+M})}function Cn(s,c,d,_){s.info(function(){return"XMLHTTP TEXT ("+c+"): "+Gh(s,d)+(_?" "+_:"")})}function Hh(s,c){s.info(function(){return"TIMEOUT: "+c})}ir.prototype.info=function(){};function Gh(s,c){if(!s.g)return c;if(!c)return null;try{const V=JSON.parse(c);if(V){for(s=0;s<V.length;s++)if(Array.isArray(V[s])){var d=V[s];if(!(d.length<2)){var _=d[1];if(Array.isArray(_)&&!(_.length<1)){var P=_[0];if(P!="noop"&&P!="stop"&&P!="close")for(let M=1;M<_.length;M++)_[M]=""}}}}return Ge(V)}catch{return c}}var ii={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},pa={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},ma;function Is(){}w(Is,u),Is.prototype.g=function(){return new XMLHttpRequest},ma=new Is;function sr(s){return encodeURIComponent(String(s))}function Wh(s){var c=1;s=s.split(":");const d=[];for(;c>0&&s.length;)d.push(s.shift()),c--;return s.length&&d.push(s.join(":")),d}function St(s,c,d,_){this.j=s,this.i=c,this.l=d,this.S=_||1,this.V=new Oe(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new ga}function ga(){this.i=null,this.g="",this.h=!1}var _a={},ws={};function vs(s,c,d){s.M=1,s.A=oi(et(c)),s.u=d,s.R=!0,ya(s,null)}function ya(s,c){s.F=Date.now(),si(s),s.B=et(s.A);var d=s.B,_=s.S;Array.isArray(_)||(_=[String(_)]),Va(d.i,"t",_),s.C=0,d=s.j.L,s.h=new ga,s.g=Qa(s.j,d?c:null,!s.u),s.P>0&&(s.O=new Sn(m(s.Y,s,s.g),s.P)),c=s.V,d=s.g,_=s.ba;var P="readystatechange";Array.isArray(P)||(P&&(Pn[0]=P.toString()),P=Pn);for(let V=0;V<P.length;V++){const M=tr(d,P[V],_||c.handleEvent,!1,c.h||c);if(!M)break;c.g[M.key]=M}c=s.J?Jr(s.J):{},s.u?(s.v||(s.v="POST"),c["Content-Type"]="application/x-www-form-urlencoded",s.g.ea(s.B,s.v,s.u,c)):(s.v="GET",s.g.ea(s.B,s.v,null,c)),re(),qh(s.i,s.v,s.B,s.l,s.S,s.u)}St.prototype.ba=function(s){s=s.target;const c=this.O;c&&bt(s)==3?c.j():this.Y(s)},St.prototype.Y=function(s){try{if(s==this.g)e:{const K=bt(this.g),Te=this.g.ya(),oe=this.g.ca();if(!(K<3)&&(K!=3||this.g&&(this.h.h||this.g.la()||Fa(this.g)))){this.K||K!=4||Te==7||(Te==8||oe<=0?re(3):re(2)),As(this);var c=this.g.ca();this.X=c;var d=Kh(this);if(this.o=c==200,zh(this.i,this.v,this.B,this.l,this.S,K,c),this.o){if(this.U&&!this.L){t:{if(this.g){var _,P=this.g;if((_=P.g?P.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!T(_)){var V=_;break t}}V=null}if(s=V)Cn(this.i,this.l,s,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Rs(this,s);else{this.o=!1,this.m=3,Be(12),Xt(this),or(this);break e}}if(this.R){s=!0;let Ce;for(;!this.K&&this.C<d.length;)if(Ce=Qh(this,d),Ce==ws){K==4&&(this.m=4,Be(14),s=!1),Cn(this.i,this.l,null,"[Incomplete Response]");break}else if(Ce==_a){this.m=4,Be(15),Cn(this.i,this.l,d,"[Invalid Chunk]"),s=!1;break}else Cn(this.i,this.l,Ce,null),Rs(this,Ce);if(Ea(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),K!=4||d.length!=0||this.h.h||(this.m=1,Be(16),s=!1),this.o=this.o&&s,!s)Cn(this.i,this.l,d,"[Invalid Chunked Response]"),Xt(this),or(this);else if(d.length>0&&!this.W){this.W=!0;var M=this.j;M.g==this&&M.aa&&!M.P&&(M.j.info("Great, no buffering proxy detected. Bytes received: "+d.length),Ns(M),M.P=!0,Be(11))}}else Cn(this.i,this.l,d,null),Rs(this,d);K==4&&Xt(this),this.o&&!this.K&&(K==4?Ha(this.j,this):(this.o=!1,si(this)))}else ud(this.g),c==400&&d.indexOf("Unknown SID")>0?(this.m=3,Be(12)):(this.m=0,Be(13)),Xt(this),or(this)}}}catch{}finally{}};function Kh(s){if(!Ea(s))return s.g.la();const c=Fa(s.g);if(c==="")return"";let d="";const _=c.length,P=bt(s.g)==4;if(!s.h.i){if(typeof TextDecoder>"u")return Xt(s),or(s),"";s.h.i=new a.TextDecoder}for(let V=0;V<_;V++)s.h.h=!0,d+=s.h.i.decode(c[V],{stream:!(P&&V==_-1)});return c.length=0,s.h.g+=d,s.C=0,s.h.g}function Ea(s){return s.g?s.v=="GET"&&s.M!=2&&s.j.Aa:!1}function Qh(s,c){var d=s.C,_=c.indexOf(`
`,d);return _==-1?ws:(d=Number(c.substring(d,_)),isNaN(d)?_a:(_+=1,_+d>c.length?ws:(c=c.slice(_,_+d),s.C=_+d,c)))}St.prototype.cancel=function(){this.K=!0,Xt(this)};function si(s){s.T=Date.now()+s.H,Ta(s,s.H)}function Ta(s,c){if(s.D!=null)throw Error("WatchDog timer not null");s.D=rr(m(s.aa,s),c)}function As(s){s.D&&(a.clearTimeout(s.D),s.D=null)}St.prototype.aa=function(){this.D=null;const s=Date.now();s-this.T>=0?(Hh(this.i,this.B),this.M!=2&&(re(),Be(17)),Xt(this),this.m=2,or(this)):Ta(this,this.T-s)};function or(s){s.j.I==0||s.K||Ha(s.j,s)}function Xt(s){As(s);var c=s.O;c&&typeof c.dispose=="function"&&c.dispose(),s.O=null,ri(s.V),s.g&&(c=s.g,s.g=null,c.abort(),c.dispose())}function Rs(s,c){try{var d=s.j;if(d.I!=0&&(d.g==s||Ss(d.h,s))){if(!s.L&&Ss(d.h,s)&&d.I==3){try{var _=d.Ba.g.parse(c)}catch{_=null}if(Array.isArray(_)&&_.length==3){var P=_;if(P[0]==0){e:if(!d.v){if(d.g)if(d.g.F+3e3<s.F)hi(d),ui(d);else break e;Ds(d),Be(18)}}else d.xa=P[1],0<d.xa-d.K&&P[2]<37500&&d.F&&d.A==0&&!d.C&&(d.C=rr(m(d.Va,d),6e3));va(d.h)<=1&&d.ta&&(d.ta=void 0)}else en(d,11)}else if((s.L||d.g==s)&&hi(d),!T(c))for(P=d.Ba.g.parse(c),c=0;c<P.length;c++){let oe=P[c];const Ce=oe[0];if(!(Ce<=d.K))if(d.K=Ce,oe=oe[1],d.I==2)if(oe[0]=="c"){d.M=oe[1],d.ba=oe[2];const tt=oe[3];tt!=null&&(d.ka=tt,d.j.info("VER="+d.ka));const tn=oe[4];tn!=null&&(d.za=tn,d.j.info("SVER="+d.za));const kt=oe[5];kt!=null&&typeof kt=="number"&&kt>0&&(_=1.5*kt,d.O=_,d.j.info("backChannelRequestTimeoutMs_="+_)),_=d;const Vt=s.g;if(Vt){const fi=Vt.g?Vt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(fi){var V=_.h;V.g||fi.indexOf("spdy")==-1&&fi.indexOf("quic")==-1&&fi.indexOf("h2")==-1||(V.j=V.l,V.g=new Set,V.h&&(Ps(V,V.h),V.h=null))}if(_.G){const xs=Vt.g?Vt.g.getResponseHeader("X-HTTP-Session-Id"):null;xs&&(_.wa=xs,ae(_.J,_.G,xs))}}d.I=3,d.l&&d.l.ra(),d.aa&&(d.T=Date.now()-s.F,d.j.info("Handshake RTT: "+d.T+"ms")),_=d;var M=s;if(_.na=Ka(_,_.L?_.ba:null,_.W),M.L){Aa(_.h,M);var K=M,Te=_.O;Te&&(K.H=Te),K.D&&(As(K),si(K)),_.g=M}else qa(_);d.i.length>0&&li(d)}else oe[0]!="stop"&&oe[0]!="close"||en(d,7);else d.I==3&&(oe[0]=="stop"||oe[0]=="close"?oe[0]=="stop"?en(d,7):Vs(d):oe[0]!="noop"&&d.l&&d.l.qa(oe),d.A=0)}}re(4)}catch{}}var Jh=class{constructor(s,c){this.g=s,this.map=c}};function Ia(s){this.l=s||10,a.PerformanceNavigationTiming?(s=a.performance.getEntriesByType("navigation"),s=s.length>0&&(s[0].nextHopProtocol=="hq"||s[0].nextHopProtocol=="h2")):s=!!(a.chrome&&a.chrome.loadTimes&&a.chrome.loadTimes()&&a.chrome.loadTimes().wasFetchedViaSpdy),this.j=s?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function wa(s){return s.h?!0:s.g?s.g.size>=s.j:!1}function va(s){return s.h?1:s.g?s.g.size:0}function Ss(s,c){return s.h?s.h==c:s.g?s.g.has(c):!1}function Ps(s,c){s.g?s.g.add(c):s.h=c}function Aa(s,c){s.h&&s.h==c?s.h=null:s.g&&s.g.has(c)&&s.g.delete(c)}Ia.prototype.cancel=function(){if(this.i=Ra(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const s of this.g.values())s.cancel();this.g.clear()}};function Ra(s){if(s.h!=null)return s.i.concat(s.h.G);if(s.g!=null&&s.g.size!==0){let c=s.i;for(const d of s.g.values())c=c.concat(d.G);return c}return N(s.i)}var Sa=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function Yh(s,c){if(s){s=s.split("&");for(let d=0;d<s.length;d++){const _=s[d].indexOf("=");let P,V=null;_>=0?(P=s[d].substring(0,_),V=s[d].substring(_+1)):P=s[d],c(P,V?decodeURIComponent(V.replace(/\+/g," ")):"")}}}function Pt(s){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let c;s instanceof Pt?(this.l=s.l,ar(this,s.j),this.o=s.o,this.g=s.g,cr(this,s.u),this.h=s.h,Cs(this,Da(s.i)),this.m=s.m):s&&(c=String(s).match(Sa))?(this.l=!1,ar(this,c[1]||"",!0),this.o=ur(c[2]||""),this.g=ur(c[3]||"",!0),cr(this,c[4]),this.h=ur(c[5]||"",!0),Cs(this,c[6]||"",!0),this.m=ur(c[7]||"")):(this.l=!1,this.i=new hr(null,this.l))}Pt.prototype.toString=function(){const s=[];var c=this.j;c&&s.push(lr(c,Pa,!0),":");var d=this.g;return(d||c=="file")&&(s.push("//"),(c=this.o)&&s.push(lr(c,Pa,!0),"@"),s.push(sr(d).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),d=this.u,d!=null&&s.push(":",String(d))),(d=this.h)&&(this.g&&d.charAt(0)!="/"&&s.push("/"),s.push(lr(d,d.charAt(0)=="/"?ed:Zh,!0))),(d=this.i.toString())&&s.push("?",d),(d=this.m)&&s.push("#",lr(d,nd)),s.join("")},Pt.prototype.resolve=function(s){const c=et(this);let d=!!s.j;d?ar(c,s.j):d=!!s.o,d?c.o=s.o:d=!!s.g,d?c.g=s.g:d=s.u!=null;var _=s.h;if(d)cr(c,s.u);else if(d=!!s.h){if(_.charAt(0)!="/")if(this.g&&!this.h)_="/"+_;else{var P=c.h.lastIndexOf("/");P!=-1&&(_=c.h.slice(0,P+1)+_)}if(P=_,P==".."||P==".")_="";else if(P.indexOf("./")!=-1||P.indexOf("/.")!=-1){_=P.lastIndexOf("/",0)==0,P=P.split("/");const V=[];for(let M=0;M<P.length;){const K=P[M++];K=="."?_&&M==P.length&&V.push(""):K==".."?((V.length>1||V.length==1&&V[0]!="")&&V.pop(),_&&M==P.length&&V.push("")):(V.push(K),_=!0)}_=V.join("/")}else _=P}return d?c.h=_:d=s.i.toString()!=="",d?Cs(c,Da(s.i)):d=!!s.m,d&&(c.m=s.m),c};function et(s){return new Pt(s)}function ar(s,c,d){s.j=d?ur(c,!0):c,s.j&&(s.j=s.j.replace(/:$/,""))}function cr(s,c){if(c){if(c=Number(c),isNaN(c)||c<0)throw Error("Bad port number "+c);s.u=c}else s.u=null}function Cs(s,c,d){c instanceof hr?(s.i=c,rd(s.i,s.l)):(d||(c=lr(c,td)),s.i=new hr(c,s.l))}function ae(s,c,d){s.i.set(c,d)}function oi(s){return ae(s,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),s}function ur(s,c){return s?c?decodeURI(s.replace(/%25/g,"%2525")):decodeURIComponent(s):""}function lr(s,c,d){return typeof s=="string"?(s=encodeURI(s).replace(c,Xh),d&&(s=s.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),s):null}function Xh(s){return s=s.charCodeAt(0),"%"+(s>>4&15).toString(16)+(s&15).toString(16)}var Pa=/[#\/\?@]/g,Zh=/[#\?:]/g,ed=/[#\?]/g,td=/[#\?@]/g,nd=/#/g;function hr(s,c){this.h=this.g=null,this.i=s||null,this.j=!!c}function Zt(s){s.g||(s.g=new Map,s.h=0,s.i&&Yh(s.i,function(c,d){s.add(decodeURIComponent(c.replace(/\+/g," ")),d)}))}n=hr.prototype,n.add=function(s,c){Zt(this),this.i=null,s=bn(this,s);let d=this.g.get(s);return d||this.g.set(s,d=[]),d.push(c),this.h+=1,this};function Ca(s,c){Zt(s),c=bn(s,c),s.g.has(c)&&(s.i=null,s.h-=s.g.get(c).length,s.g.delete(c))}function ba(s,c){return Zt(s),c=bn(s,c),s.g.has(c)}n.forEach=function(s,c){Zt(this),this.g.forEach(function(d,_){d.forEach(function(P){s.call(c,P,_,this)},this)},this)};function ka(s,c){Zt(s);let d=[];if(typeof c=="string")ba(s,c)&&(d=d.concat(s.g.get(bn(s,c))));else for(s=Array.from(s.g.values()),c=0;c<s.length;c++)d=d.concat(s[c]);return d}n.set=function(s,c){return Zt(this),this.i=null,s=bn(this,s),ba(this,s)&&(this.h-=this.g.get(s).length),this.g.set(s,[c]),this.h+=1,this},n.get=function(s,c){return s?(s=ka(this,s),s.length>0?String(s[0]):c):c};function Va(s,c,d){Ca(s,c),d.length>0&&(s.i=null,s.g.set(bn(s,c),N(d)),s.h+=d.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const s=[],c=Array.from(this.g.keys());for(let _=0;_<c.length;_++){var d=c[_];const P=sr(d);d=ka(this,d);for(let V=0;V<d.length;V++){let M=P;d[V]!==""&&(M+="="+sr(d[V])),s.push(M)}}return this.i=s.join("&")};function Da(s){const c=new hr;return c.i=s.i,s.g&&(c.g=new Map(s.g),c.h=s.h),c}function bn(s,c){return c=String(c),s.j&&(c=c.toLowerCase()),c}function rd(s,c){c&&!s.j&&(Zt(s),s.i=null,s.g.forEach(function(d,_){const P=_.toLowerCase();_!=P&&(Ca(this,_),Va(this,P,d))},s)),s.j=c}function id(s,c){const d=new ir;if(a.Image){const _=new Image;_.onload=p(Ct,d,"TestLoadImage: loaded",!0,c,_),_.onerror=p(Ct,d,"TestLoadImage: error",!1,c,_),_.onabort=p(Ct,d,"TestLoadImage: abort",!1,c,_),_.ontimeout=p(Ct,d,"TestLoadImage: timeout",!1,c,_),a.setTimeout(function(){_.ontimeout&&_.ontimeout()},1e4),_.src=s}else c(!1)}function sd(s,c){const d=new ir,_=new AbortController,P=setTimeout(()=>{_.abort(),Ct(d,"TestPingServer: timeout",!1,c)},1e4);fetch(s,{signal:_.signal}).then(V=>{clearTimeout(P),V.ok?Ct(d,"TestPingServer: ok",!0,c):Ct(d,"TestPingServer: server error",!1,c)}).catch(()=>{clearTimeout(P),Ct(d,"TestPingServer: error",!1,c)})}function Ct(s,c,d,_,P){try{P&&(P.onload=null,P.onerror=null,P.onabort=null,P.ontimeout=null),_(d)}catch{}}function od(){this.g=new g}function bs(s){this.i=s.Sb||null,this.h=s.ab||!1}w(bs,u),bs.prototype.g=function(){return new ai(this.i,this.h)};function ai(s,c){Pe.call(this),this.H=s,this.o=c,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}w(ai,Pe),n=ai.prototype,n.open=function(s,c){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=s,this.D=c,this.readyState=1,fr(this)},n.send=function(s){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const c={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};s&&(c.body=s),(this.H||a).fetch(new Request(this.D,c)).then(this.Pa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,dr(this)),this.readyState=0},n.Pa=function(s){if(this.g&&(this.l=s,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=s.headers,this.readyState=2,fr(this)),this.g&&(this.readyState=3,fr(this),this.g)))if(this.responseType==="arraybuffer")s.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof a.ReadableStream<"u"&&"body"in s){if(this.j=s.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;Na(this)}else s.text().then(this.Oa.bind(this),this.ga.bind(this))};function Na(s){s.j.read().then(s.Ma.bind(s)).catch(s.ga.bind(s))}n.Ma=function(s){if(this.g){if(this.o&&s.value)this.response.push(s.value);else if(!this.o){var c=s.value?s.value:new Uint8Array(0);(c=this.B.decode(c,{stream:!s.done}))&&(this.response=this.responseText+=c)}s.done?dr(this):fr(this),this.readyState==3&&Na(this)}},n.Oa=function(s){this.g&&(this.response=this.responseText=s,dr(this))},n.Na=function(s){this.g&&(this.response=s,dr(this))},n.ga=function(){this.g&&dr(this)};function dr(s){s.readyState=4,s.l=null,s.j=null,s.B=null,fr(s)}n.setRequestHeader=function(s,c){this.A.append(s,c)},n.getResponseHeader=function(s){return this.h&&this.h.get(s.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const s=[],c=this.h.entries();for(var d=c.next();!d.done;)d=d.value,s.push(d[0]+": "+d[1]),d=c.next();return s.join(`\r
`)};function fr(s){s.onreadystatechange&&s.onreadystatechange.call(s)}Object.defineProperty(ai.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(s){this.m=s?"include":"same-origin"}});function xa(s){let c="";return En(s,function(d,_){c+=_,c+=":",c+=d,c+=`\r
`}),c}function ks(s,c,d){e:{for(_ in d){var _=!1;break e}_=!0}_||(d=xa(d),typeof s=="string"?d!=null&&sr(d):ae(s,c,d))}function fe(s){Pe.call(this),this.headers=new Map,this.L=s||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}w(fe,Pe);var ad=/^https?$/i,cd=["POST","PUT"];n=fe.prototype,n.Fa=function(s){this.H=s},n.ea=function(s,c,d,_){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+s);c=c?c.toUpperCase():"GET",this.D=s,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():ma.g(),this.g.onreadystatechange=k(m(this.Ca,this));try{this.B=!0,this.g.open(c,String(s),!0),this.B=!1}catch(V){Oa(this,V);return}if(s=d||"",d=new Map(this.headers),_)if(Object.getPrototypeOf(_)===Object.prototype)for(var P in _)d.set(P,_[P]);else if(typeof _.keys=="function"&&typeof _.get=="function")for(const V of _.keys())d.set(V,_.get(V));else throw Error("Unknown input type for opt_headers: "+String(_));_=Array.from(d.keys()).find(V=>V.toLowerCase()=="content-type"),P=a.FormData&&s instanceof a.FormData,!(Array.prototype.indexOf.call(cd,c,void 0)>=0)||_||P||d.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[V,M]of d)this.g.setRequestHeader(V,M);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(s),this.v=!1}catch(V){Oa(this,V)}};function Oa(s,c){s.h=!1,s.g&&(s.j=!0,s.g.abort(),s.j=!1),s.l=c,s.o=5,Ma(s),ci(s)}function Ma(s){s.A||(s.A=!0,Ee(s,"complete"),Ee(s,"error"))}n.abort=function(s){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=s||7,Ee(this,"complete"),Ee(this,"abort"),ci(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),ci(this,!0)),fe.Z.N.call(this)},n.Ca=function(){this.u||(this.B||this.v||this.j?La(this):this.Xa())},n.Xa=function(){La(this)};function La(s){if(s.h&&typeof o<"u"){if(s.v&&bt(s)==4)setTimeout(s.Ca.bind(s),0);else if(Ee(s,"readystatechange"),bt(s)==4){s.h=!1;try{const V=s.ca();e:switch(V){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var c=!0;break e;default:c=!1}var d;if(!(d=c)){var _;if(_=V===0){let M=String(s.D).match(Sa)[1]||null;!M&&a.self&&a.self.location&&(M=a.self.location.protocol.slice(0,-1)),_=!ad.test(M?M.toLowerCase():"")}d=_}if(d)Ee(s,"complete"),Ee(s,"success");else{s.o=6;try{var P=bt(s)>2?s.g.statusText:""}catch{P=""}s.l=P+" ["+s.ca()+"]",Ma(s)}}finally{ci(s)}}}}function ci(s,c){if(s.g){s.m&&(clearTimeout(s.m),s.m=null);const d=s.g;s.g=null,c||Ee(s,"ready");try{d.onreadystatechange=null}catch{}}}n.isActive=function(){return!!this.g};function bt(s){return s.g?s.g.readyState:0}n.ca=function(){try{return bt(this)>2?this.g.status:-1}catch{return-1}},n.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.La=function(s){if(this.g){var c=this.g.responseText;return s&&c.indexOf(s)==0&&(c=c.substring(s.length)),Ts(c)}};function Fa(s){try{if(!s.g)return null;if("response"in s.g)return s.g.response;switch(s.F){case"":case"text":return s.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in s.g)return s.g.mozResponseArrayBuffer}return null}catch{return null}}function ud(s){const c={};s=(s.g&&bt(s)>=2&&s.g.getAllResponseHeaders()||"").split(`\r
`);for(let _=0;_<s.length;_++){if(T(s[_]))continue;var d=Wh(s[_]);const P=d[0];if(d=d[1],typeof d!="string")continue;d=d.trim();const V=c[P]||[];c[P]=V,V.push(d)}ys(c,function(_){return _.join(", ")})}n.ya=function(){return this.o},n.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function pr(s,c,d){return d&&d.internalChannelParams&&d.internalChannelParams[s]||c}function Ua(s){this.za=0,this.i=[],this.j=new ir,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=pr("failFast",!1,s),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=pr("baseRetryDelayMs",5e3,s),this.Za=pr("retryDelaySeedMs",1e4,s),this.Ta=pr("forwardChannelMaxRetries",2,s),this.va=pr("forwardChannelRequestTimeoutMs",2e4,s),this.ma=s&&s.xmlHttpFactory||void 0,this.Ua=s&&s.Rb||void 0,this.Aa=s&&s.useFetchStreams||!1,this.O=void 0,this.L=s&&s.supportsCrossDomainXhr||!1,this.M="",this.h=new Ia(s&&s.concurrentRequestLimit),this.Ba=new od,this.S=s&&s.fastHandshake||!1,this.R=s&&s.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=s&&s.Pb||!1,s&&s.ua&&this.j.ua(),s&&s.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&s&&s.detectBufferingProxy||!1,this.ia=void 0,s&&s.longPollingTimeout&&s.longPollingTimeout>0&&(this.ia=s.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}n=Ua.prototype,n.ka=8,n.I=1,n.connect=function(s,c,d,_){Be(0),this.W=s,this.H=c||{},d&&_!==void 0&&(this.H.OSID=d,this.H.OAID=_),this.F=this.X,this.J=Ka(this,null,this.W),li(this)};function Vs(s){if(Ba(s),s.I==3){var c=s.V++,d=et(s.J);if(ae(d,"SID",s.M),ae(d,"RID",c),ae(d,"TYPE","terminate"),mr(s,d),c=new St(s,s.j,c),c.M=2,c.A=oi(et(d)),d=!1,a.navigator&&a.navigator.sendBeacon)try{d=a.navigator.sendBeacon(c.A.toString(),"")}catch{}!d&&a.Image&&(new Image().src=c.A,d=!0),d||(c.g=Qa(c.j,null),c.g.ea(c.A)),c.F=Date.now(),si(c)}Wa(s)}function ui(s){s.g&&(Ns(s),s.g.cancel(),s.g=null)}function Ba(s){ui(s),s.v&&(a.clearTimeout(s.v),s.v=null),hi(s),s.h.cancel(),s.m&&(typeof s.m=="number"&&a.clearTimeout(s.m),s.m=null)}function li(s){if(!wa(s.h)&&!s.m){s.m=!0;var c=s.Ea;Re||E(),ye||(Re(),ye=!0),R.add(c,s),s.D=0}}function ld(s,c){return va(s.h)>=s.h.j-(s.m?1:0)?!1:s.m?(s.i=c.G.concat(s.i),!0):s.I==1||s.I==2||s.D>=(s.Sa?0:s.Ta)?!1:(s.m=rr(m(s.Ea,s,c),Ga(s,s.D)),s.D++,!0)}n.Ea=function(s){if(this.m)if(this.m=null,this.I==1){if(!s){this.V=Math.floor(Math.random()*1e5),s=this.V++;const P=new St(this,this.j,s);let V=this.o;if(this.U&&(V?(V=Jr(V),Xr(V,this.U)):V=this.U),this.u!==null||this.R||(P.J=V,V=null),this.S)e:{for(var c=0,d=0;d<this.i.length;d++){t:{var _=this.i[d];if("__data__"in _.map&&(_=_.map.__data__,typeof _=="string")){_=_.length;break t}_=void 0}if(_===void 0)break;if(c+=_,c>4096){c=d;break e}if(c===4096||d===this.i.length-1){c=d+1;break e}}c=1e3}else c=1e3;c=$a(this,P,c),d=et(this.J),ae(d,"RID",s),ae(d,"CVER",22),this.G&&ae(d,"X-HTTP-Session-Id",this.G),mr(this,d),V&&(this.R?c="headers="+sr(xa(V))+"&"+c:this.u&&ks(d,this.u,V)),Ps(this.h,P),this.Ra&&ae(d,"TYPE","init"),this.S?(ae(d,"$req",c),ae(d,"SID","null"),P.U=!0,vs(P,d,null)):vs(P,d,c),this.I=2}}else this.I==3&&(s?ja(this,s):this.i.length==0||wa(this.h)||ja(this))};function ja(s,c){var d;c?d=c.l:d=s.V++;const _=et(s.J);ae(_,"SID",s.M),ae(_,"RID",d),ae(_,"AID",s.K),mr(s,_),s.u&&s.o&&ks(_,s.u,s.o),d=new St(s,s.j,d,s.D+1),s.u===null&&(d.J=s.o),c&&(s.i=c.G.concat(s.i)),c=$a(s,d,1e3),d.H=Math.round(s.va*.5)+Math.round(s.va*.5*Math.random()),Ps(s.h,d),vs(d,_,c)}function mr(s,c){s.H&&En(s.H,function(d,_){ae(c,_,d)}),s.l&&En({},function(d,_){ae(c,_,d)})}function $a(s,c,d){d=Math.min(s.i.length,d);const _=s.l?m(s.l.Ka,s.l,s):null;e:{var P=s.i;let K=-1;for(;;){const Te=["count="+d];K==-1?d>0?(K=P[0].g,Te.push("ofs="+K)):K=0:Te.push("ofs="+K);let oe=!0;for(let Ce=0;Ce<d;Ce++){var V=P[Ce].g;const tt=P[Ce].map;if(V-=K,V<0)K=Math.max(0,P[Ce].g-100),oe=!1;else try{V="req"+V+"_"||"";try{var M=tt instanceof Map?tt:Object.entries(tt);for(const[tn,kt]of M){let Vt=kt;h(kt)&&(Vt=Ge(kt)),Te.push(V+tn+"="+encodeURIComponent(Vt))}}catch(tn){throw Te.push(V+"type="+encodeURIComponent("_badmap")),tn}}catch{_&&_(tt)}}if(oe){M=Te.join("&");break e}}M=void 0}return s=s.i.splice(0,d),c.G=s,M}function qa(s){if(!s.g&&!s.v){s.Y=1;var c=s.Da;Re||E(),ye||(Re(),ye=!0),R.add(c,s),s.A=0}}function Ds(s){return s.g||s.v||s.A>=3?!1:(s.Y++,s.v=rr(m(s.Da,s),Ga(s,s.A)),s.A++,!0)}n.Da=function(){if(this.v=null,za(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var s=4*this.T;this.j.info("BP detection timer enabled: "+s),this.B=rr(m(this.Wa,this),s)}},n.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,Be(10),ui(this),za(this))};function Ns(s){s.B!=null&&(a.clearTimeout(s.B),s.B=null)}function za(s){s.g=new St(s,s.j,"rpc",s.Y),s.u===null&&(s.g.J=s.o),s.g.P=0;var c=et(s.na);ae(c,"RID","rpc"),ae(c,"SID",s.M),ae(c,"AID",s.K),ae(c,"CI",s.F?"0":"1"),!s.F&&s.ia&&ae(c,"TO",s.ia),ae(c,"TYPE","xmlhttp"),mr(s,c),s.u&&s.o&&ks(c,s.u,s.o),s.O&&(s.g.H=s.O);var d=s.g;s=s.ba,d.M=1,d.A=oi(et(c)),d.u=null,d.R=!0,ya(d,s)}n.Va=function(){this.C!=null&&(this.C=null,ui(this),Ds(this),Be(19))};function hi(s){s.C!=null&&(a.clearTimeout(s.C),s.C=null)}function Ha(s,c){var d=null;if(s.g==c){hi(s),Ns(s),s.g=null;var _=2}else if(Ss(s.h,c))d=c.G,Aa(s.h,c),_=1;else return;if(s.I!=0){if(c.o)if(_==1){d=c.u?c.u.length:0,c=Date.now()-c.F;var P=s.D;_=ie(),Ee(_,new fa(_,d)),li(s)}else qa(s);else if(P=c.m,P==3||P==0&&c.X>0||!(_==1&&ld(s,c)||_==2&&Ds(s)))switch(d&&d.length>0&&(c=s.h,c.i=c.i.concat(d)),P){case 1:en(s,5);break;case 4:en(s,10);break;case 3:en(s,6);break;default:en(s,2)}}}function Ga(s,c){let d=s.Qa+Math.floor(Math.random()*s.Za);return s.isActive()||(d*=2),d*c}function en(s,c){if(s.j.info("Error code "+c),c==2){var d=m(s.bb,s),_=s.Ua;const P=!_;_=new Pt(_||"//www.google.com/images/cleardot.gif"),a.location&&a.location.protocol=="http"||ar(_,"https"),oi(_),P?id(_.toString(),d):sd(_.toString(),d)}else Be(2);s.I=0,s.l&&s.l.pa(c),Wa(s),Ba(s)}n.bb=function(s){s?(this.j.info("Successfully pinged google.com"),Be(2)):(this.j.info("Failed to ping google.com"),Be(1))};function Wa(s){if(s.I=0,s.ja=[],s.l){const c=Ra(s.h);(c.length!=0||s.i.length!=0)&&(L(s.ja,c),L(s.ja,s.i),s.h.i.length=0,N(s.i),s.i.length=0),s.l.oa()}}function Ka(s,c,d){var _=d instanceof Pt?et(d):new Pt(d);if(_.g!="")c&&(_.g=c+"."+_.g),cr(_,_.u);else{var P=a.location;_=P.protocol,c=c?c+"."+P.hostname:P.hostname,P=+P.port;const V=new Pt(null);_&&ar(V,_),c&&(V.g=c),P&&cr(V,P),d&&(V.h=d),_=V}return d=s.G,c=s.wa,d&&c&&ae(_,d,c),ae(_,"VER",s.ka),mr(s,_),_}function Qa(s,c,d){if(c&&!s.L)throw Error("Can't create secondary domain capable XhrIo object.");return c=s.Aa&&!s.ma?new fe(new bs({ab:d})):new fe(s.ma),c.Fa(s.L),c}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function Ja(){}n=Ja.prototype,n.ra=function(){},n.qa=function(){},n.pa=function(){},n.oa=function(){},n.isActive=function(){return!0},n.Ka=function(){};function di(){}di.prototype.g=function(s,c){return new ze(s,c)};function ze(s,c){Pe.call(this),this.g=new Ua(c),this.l=s,this.h=c&&c.messageUrlParams||null,s=c&&c.messageHeaders||null,c&&c.clientProtocolHeaderRequired&&(s?s["X-Client-Protocol"]="webchannel":s={"X-Client-Protocol":"webchannel"}),this.g.o=s,s=c&&c.initMessageHeaders||null,c&&c.messageContentType&&(s?s["X-WebChannel-Content-Type"]=c.messageContentType:s={"X-WebChannel-Content-Type":c.messageContentType}),c&&c.sa&&(s?s["X-WebChannel-Client-Profile"]=c.sa:s={"X-WebChannel-Client-Profile":c.sa}),this.g.U=s,(s=c&&c.Qb)&&!T(s)&&(this.g.u=s),this.A=c&&c.supportsCrossDomainXhr||!1,this.v=c&&c.sendRawJson||!1,(c=c&&c.httpSessionIdParam)&&!T(c)&&(this.g.G=c,s=this.h,s!==null&&c in s&&(s=this.h,c in s&&delete s[c])),this.j=new kn(this)}w(ze,Pe),ze.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},ze.prototype.close=function(){Vs(this.g)},ze.prototype.o=function(s){var c=this.g;if(typeof s=="string"){var d={};d.__data__=s,s=d}else this.v&&(d={},d.__data__=Ge(s),s=d);c.i.push(new Jh(c.Ya++,s)),c.I==3&&li(c)},ze.prototype.N=function(){this.g.l=null,delete this.j,Vs(this.g),delete this.g,ze.Z.N.call(this)};function Ya(s){A.call(this),s.__headers__&&(this.headers=s.__headers__,this.statusCode=s.__status__,delete s.__headers__,delete s.__status__);var c=s.__sm__;if(c){e:{for(const d in c){s=d;break e}s=void 0}(this.i=s)&&(s=this.i,c=c!==null&&s in c?c[s]:void 0),this.data=c}else this.data=s}w(Ya,A);function Xa(){b.call(this),this.status=1}w(Xa,b);function kn(s){this.g=s}w(kn,Ja),kn.prototype.ra=function(){Ee(this.g,"a")},kn.prototype.qa=function(s){Ee(this.g,new Ya(s))},kn.prototype.pa=function(s){Ee(this.g,new Xa)},kn.prototype.oa=function(){Ee(this.g,"b")},di.prototype.createWebChannel=di.prototype.g,ze.prototype.send=ze.prototype.o,ze.prototype.open=ze.prototype.m,ze.prototype.close=ze.prototype.close,Tl=function(){return new di},El=function(){return ie()},yl=D,io={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},ii.NO_ERROR=0,ii.TIMEOUT=8,ii.HTTP_ERROR=6,Ri=ii,pa.COMPLETE="complete",_l=pa,l.EventType=y,y.OPEN="a",y.CLOSE="b",y.ERROR="c",y.MESSAGE="d",Pe.prototype.listen=Pe.prototype.J,_r=l,fe.prototype.listenOnce=fe.prototype.K,fe.prototype.getLastError=fe.prototype.Ha,fe.prototype.getLastErrorCode=fe.prototype.ya,fe.prototype.getStatus=fe.prototype.ca,fe.prototype.getResponseJson=fe.prototype.La,fe.prototype.getResponseText=fe.prototype.la,fe.prototype.send=fe.prototype.ea,fe.prototype.setWithCredentials=fe.prototype.Fa,gl=fe}).apply(typeof mi<"u"?mi:typeof self<"u"?self:typeof window<"u"?window:{});/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Le{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}Le.UNAUTHENTICATED=new Le(null),Le.GOOGLE_CREDENTIALS=new Le("google-credentials-uid"),Le.FIRST_PARTY=new Le("first-party-uid"),Le.MOCK_USER=new Le("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Yn="12.11.0";function vg(n){Yn=n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fn=new Io("@firebase/firestore");function Dn(){return fn.logLevel}function F(n,...e){if(fn.logLevel<=Q.DEBUG){const t=e.map(Oo);fn.debug(`Firestore (${Yn}): ${n}`,...t)}}function It(n,...e){if(fn.logLevel<=Q.ERROR){const t=e.map(Oo);fn.error(`Firestore (${Yn}): ${n}`,...t)}}function pn(n,...e){if(fn.logLevel<=Q.WARN){const t=e.map(Oo);fn.warn(`Firestore (${Yn}): ${n}`,...t)}}function Oo(n){if(typeof n=="string")return n;try{return function(t){return JSON.stringify(t)}(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function q(n,e,t){let r="Unexpected state";typeof e=="string"?r=e:t=e,Il(n,r,t)}function Il(n,e,t){let r=`FIRESTORE (${Yn}) INTERNAL ASSERTION FAILED: ${e} (ID: ${n.toString(16)})`;if(t!==void 0)try{r+=" CONTEXT: "+JSON.stringify(t)}catch{r+=" CONTEXT: "+t}throw It(r),new Error(r)}function ne(n,e,t,r){let i="Unexpected state";typeof t=="string"?i=t:r=t,n||Il(e,i,r)}function G(n,e){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const O={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class B extends At{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $t{constructor(){this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wl{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class Ag{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable(()=>t(Le.UNAUTHENTICATED))}shutdown(){}}class Rg{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable(()=>t(this.token.user))}shutdown(){this.changeListener=null}}class Sg{constructor(e){this.t=e,this.currentUser=Le.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){ne(this.o===void 0,42304);let r=this.i;const i=f=>this.i!==r?(r=this.i,t(f)):Promise.resolve();let o=new $t;this.o=()=>{this.i++,this.currentUser=this.u(),o.resolve(),o=new $t,e.enqueueRetryable(()=>i(this.currentUser))};const a=()=>{const f=o;e.enqueueRetryable(async()=>{await f.promise,await i(this.currentUser)})},h=f=>{F("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=f,this.o&&(this.auth.addAuthTokenListener(this.o),a())};this.t.onInit(f=>h(f)),setTimeout(()=>{if(!this.auth){const f=this.t.getImmediate({optional:!0});f?h(f):(F("FirebaseAuthCredentialsProvider","Auth not yet detected"),o.resolve(),o=new $t)}},0),a()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then(r=>this.i!==e?(F("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(ne(typeof r.accessToken=="string",31837,{l:r}),new wl(r.accessToken,this.currentUser)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return ne(e===null||typeof e=="string",2055,{h:e}),new Le(e)}}class Pg{constructor(e,t,r){this.P=e,this.T=t,this.I=r,this.type="FirstParty",this.user=Le.FIRST_PARTY,this.R=new Map}A(){return this.I?this.I():null}get headers(){this.R.set("X-Goog-AuthUser",this.P);const e=this.A();return e&&this.R.set("Authorization",e),this.T&&this.R.set("X-Goog-Iam-Authorization-Token",this.T),this.R}}class Cg{constructor(e,t,r){this.P=e,this.T=t,this.I=r}getToken(){return Promise.resolve(new Pg(this.P,this.T,this.I))}start(e,t){e.enqueueRetryable(()=>t(Le.FIRST_PARTY))}shutdown(){}invalidateToken(){}}class Pc{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class bg{constructor(e,t){this.V=t,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,Qe(e)&&e.settings.appCheckToken&&(this.p=e.settings.appCheckToken)}start(e,t){ne(this.o===void 0,3512);const r=o=>{o.error!=null&&F("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${o.error.message}`);const a=o.token!==this.m;return this.m=o.token,F("FirebaseAppCheckTokenProvider",`Received ${a?"new":"existing"} token.`),a?t(o.token):Promise.resolve()};this.o=o=>{e.enqueueRetryable(()=>r(o))};const i=o=>{F("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=o,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit(o=>i(o)),setTimeout(()=>{if(!this.appCheck){const o=this.V.getImmediate({optional:!0});o?i(o):F("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}},0)}getToken(){if(this.p)return Promise.resolve(new Pc(this.p));const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then(t=>t?(ne(typeof t.token=="string",44558,{tokenResult:t}),this.m=t.token,new Pc(t.token)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function kg(n){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mo{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const i=kg(40);for(let o=0;o<i.length;++o)r.length<20&&i[o]<t&&(r+=e.charAt(i[o]%62))}return r}}function J(n,e){return n<e?-1:n>e?1:0}function so(n,e){const t=Math.min(n.length,e.length);for(let r=0;r<t;r++){const i=n.charAt(r),o=e.charAt(r);if(i!==o)return qs(i)===qs(o)?J(i,o):qs(i)?1:-1}return J(n.length,e.length)}const Vg=55296,Dg=57343;function qs(n){const e=n.charCodeAt(0);return e>=Vg&&e<=Dg}function zn(n,e,t){return n.length===e.length&&n.every((r,i)=>t(r,e[i]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Cc="__name__";class it{constructor(e,t,r){t===void 0?t=0:t>e.length&&q(637,{offset:t,range:e.length}),r===void 0?r=e.length-t:r>e.length-t&&q(1746,{length:r,range:e.length-t}),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return it.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof it?e.forEach(r=>{t.push(r)}):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const r=Math.min(e.length,t.length);for(let i=0;i<r;i++){const o=it.compareSegments(e.get(i),t.get(i));if(o!==0)return o}return J(e.length,t.length)}static compareSegments(e,t){const r=it.isNumericId(e),i=it.isNumericId(t);return r&&!i?-1:!r&&i?1:r&&i?it.extractNumericId(e).compare(it.extractNumericId(t)):so(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return jt.fromString(e.substring(4,e.length-2))}}class he extends it{construct(e,t,r){return new he(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const r of e){if(r.indexOf("//")>=0)throw new B(O.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter(i=>i.length>0))}return new he(t)}static emptyPath(){return new he([])}}const Ng=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class Ve extends it{construct(e,t,r){return new Ve(e,t,r)}static isValidIdentifier(e){return Ng.test(e)}canonicalString(){return this.toArray().map(e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),Ve.isValidIdentifier(e)||(e="`"+e+"`"),e)).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===Cc}static keyField(){return new Ve([Cc])}static fromServerFormat(e){const t=[];let r="",i=0;const o=()=>{if(r.length===0)throw new B(O.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""};let a=!1;for(;i<e.length;){const h=e[i];if(h==="\\"){if(i+1===e.length)throw new B(O.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const f=e[i+1];if(f!=="\\"&&f!=="."&&f!=="`")throw new B(O.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);r+=f,i+=2}else h==="`"?(a=!a,i++):h!=="."||a?(r+=h,i++):(o(),i++)}if(o(),a)throw new B(O.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new Ve(t)}static emptyPath(){return new Ve([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ${constructor(e){this.path=e}static fromPath(e){return new $(he.fromString(e))}static fromName(e){return new $(he.fromString(e).popFirst(5))}static empty(){return new $(he.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&he.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return he.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new $(new he(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xg(n,e,t){if(!t)throw new B(O.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${e}.`)}function Og(n,e,t,r){if(e===!0&&r===!0)throw new B(O.INVALID_ARGUMENT,`${n} and ${t} cannot be used together.`)}function bc(n){if(!$.isDocumentKey(n))throw new B(O.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function vl(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function Lo(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const e=function(r){return r.constructor?r.constructor.name:null}(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":q(12329,{type:typeof n})}function mn(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new B(O.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=Lo(n);throw new B(O.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return n}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _e(n,e){const t={typeString:n};return e&&(t.value=e),t}function zr(n,e){if(!vl(n))throw new B(O.INVALID_ARGUMENT,"JSON must be an object");let t;for(const r in e)if(e[r]){const i=e[r].typeString,o="value"in e[r]?{value:e[r].value}:void 0;if(!(r in n)){t=`JSON missing required field: '${r}'`;break}const a=n[r];if(i&&typeof a!==i){t=`JSON field '${r}' must be a ${i}.`;break}if(o!==void 0&&a!==o.value){t=`Expected '${r}' field to equal '${o.value}'`;break}}if(t)throw new B(O.INVALID_ARGUMENT,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kc=-62135596800,Vc=1e6;class ce{static now(){return ce.fromMillis(Date.now())}static fromDate(e){return ce.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),r=Math.floor((e-1e3*t)*Vc);return new ce(t,r)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new B(O.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new B(O.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<kc)throw new B(O.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new B(O.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/Vc}_compareTo(e){return this.seconds===e.seconds?J(this.nanoseconds,e.nanoseconds):J(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:ce._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(zr(e,ce._jsonSchema))return new ce(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-kc;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}ce._jsonSchemaVersion="firestore/timestamp/1.0",ce._jsonSchema={type:_e("string",ce._jsonSchemaVersion),seconds:_e("number"),nanoseconds:_e("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class H{static fromTimestamp(e){return new H(e)}static min(){return new H(new ce(0,0))}static max(){return new H(new ce(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const br=-1;function Mg(n,e){const t=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,i=H.fromTimestamp(r===1e9?new ce(t+1,0):new ce(t,r));return new qt(i,$.empty(),e)}function Lg(n){return new qt(n.readTime,n.key,br)}class qt{constructor(e,t,r){this.readTime=e,this.documentKey=t,this.largestBatchId=r}static min(){return new qt(H.min(),$.empty(),br)}static max(){return new qt(H.max(),$.empty(),br)}}function Fg(n,e){let t=n.readTime.compareTo(e.readTime);return t!==0?t:(t=$.comparator(n.documentKey,e.documentKey),t!==0?t:J(n.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ug="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class Bg{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach(e=>e())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Xn(n){if(n.code!==O.FAILED_PRECONDITION||n.message!==Ug)throw n;F("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class x{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e(t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)},t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)})}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&q(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new x((r,i)=>{this.nextCallback=o=>{this.wrapSuccess(e,o).next(r,i)},this.catchCallback=o=>{this.wrapFailure(t,o).next(r,i)}})}toPromise(){return new Promise((e,t)=>{this.next(e,t)})}wrapUserFunction(e){try{const t=e();return t instanceof x?t:x.resolve(t)}catch(t){return x.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction(()=>e(t)):x.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction(()=>e(t)):x.reject(t)}static resolve(e){return new x((t,r)=>{t(e)})}static reject(e){return new x((t,r)=>{r(e)})}static waitFor(e){return new x((t,r)=>{let i=0,o=0,a=!1;e.forEach(h=>{++i,h.next(()=>{++o,a&&o===i&&t()},f=>r(f))}),a=!0,o===i&&t()})}static or(e){let t=x.resolve(!1);for(const r of e)t=t.next(i=>i?x.resolve(i):r());return t}static forEach(e,t){const r=[];return e.forEach((i,o)=>{r.push(t.call(this,i,o))}),this.waitFor(r)}static mapArray(e,t){return new x((r,i)=>{const o=e.length,a=new Array(o);let h=0;for(let f=0;f<o;f++){const m=f;t(e[m]).next(p=>{a[m]=p,++h,h===o&&r(a)},p=>i(p))}})}static doWhile(e,t){return new x((r,i)=>{const o=()=>{e()===!0?t().next(()=>{o()},i):r()};o()})}}function jg(n){const e=n.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}function Zn(n){return n.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ts{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=r=>this.ae(r),this.ue=r=>t.writeSequenceNumber(r))}ae(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.ue&&this.ue(e),e}}ts.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fo=-1;function ns(n){return n==null}function Ui(n){return n===0&&1/n==-1/0}function $g(n){return typeof n=="number"&&Number.isInteger(n)&&!Ui(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Al="";function qg(n){let e="";for(let t=0;t<n.length;t++)e.length>0&&(e=Dc(e)),e=zg(n.get(t),e);return Dc(e)}function zg(n,e){let t=e;const r=n.length;for(let i=0;i<r;i++){const o=n.charAt(i);switch(o){case"\0":t+="";break;case Al:t+="";break;default:t+=o}}return t}function Dc(n){return n+Al+""}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Nc(n){let e=0;for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function Qt(n,e){for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}function Rl(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class de{constructor(e,t){this.comparator=e,this.root=t||ke.EMPTY}insert(e,t){return new de(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,ke.BLACK,null,null))}remove(e){return new de(this.comparator,this.root.remove(e,this.comparator).copy(null,null,ke.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(e,r.key);if(i===0)return t+r.left.size;i<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal((t,r)=>(e(t,r),!1))}toString(){const e=[];return this.inorderTraversal((t,r)=>(e.push(`${t}:${r}`),!1)),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new gi(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new gi(this.root,e,this.comparator,!1)}getReverseIterator(){return new gi(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new gi(this.root,e,this.comparator,!0)}}class gi{constructor(e,t,r,i){this.isReverse=i,this.nodeStack=[];let o=1;for(;!e.isEmpty();)if(o=t?r(e.key,t):1,t&&i&&(o*=-1),o<0)e=this.isReverse?e.left:e.right;else{if(o===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class ke{constructor(e,t,r,i,o){this.key=e,this.value=t,this.color=r??ke.RED,this.left=i??ke.EMPTY,this.right=o??ke.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,i,o){return new ke(e??this.key,t??this.value,r??this.color,i??this.left,o??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let i=this;const o=r(e,i.key);return i=o<0?i.copy(null,null,null,i.left.insert(e,t,r),null):o===0?i.copy(null,t,null,null,null):i.copy(null,null,null,null,i.right.insert(e,t,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return ke.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,i=this;if(t(e,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),t(e,i.key)===0){if(i.right.isEmpty())return ke.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,ke.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,ke.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw q(43730,{key:this.key,value:this.value});if(this.right.isRed())throw q(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw q(27949);return e+(this.isRed()?0:1)}}ke.EMPTY=null,ke.RED=!0,ke.BLACK=!1;ke.EMPTY=new class{constructor(){this.size=0}get key(){throw q(57766)}get value(){throw q(16141)}get color(){throw q(16727)}get left(){throw q(29726)}get right(){throw q(36894)}copy(e,t,r,i,o){return this}insert(e,t,r){return new ke(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ve{constructor(e){this.comparator=e,this.data=new de(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal((t,r)=>(e(t),!1))}forEachInRange(e,t){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,e[1])>=0)return;t(i.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new xc(this.data.getIterator())}getIteratorFrom(e){return new xc(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach(r=>{t=t.add(r)}),t}isEqual(e){if(!(e instanceof ve)||this.size!==e.size)return!1;const t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){const i=t.getNext().key,o=r.getNext().key;if(this.comparator(i,o)!==0)return!1}return!0}toArray(){const e=[];return this.forEach(t=>{e.push(t)}),e}toString(){const e=[];return this.forEach(t=>e.push(t)),"SortedSet("+e.toString()+")"}copy(e){const t=new ve(this.comparator);return t.data=e,t}}class xc{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class He{constructor(e){this.fields=e,e.sort(Ve.comparator)}static empty(){return new He([])}unionWith(e){let t=new ve(Ve.comparator);for(const r of this.fields)t=t.add(r);for(const r of e)t=t.add(r);return new He(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return zn(this.fields,e.fields,(t,r)=>t.isEqual(r))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sl extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class De{constructor(e){this.binaryString=e}static fromBase64String(e){const t=function(i){try{return atob(i)}catch(o){throw typeof DOMException<"u"&&o instanceof DOMException?new Sl("Invalid base64 string: "+o):o}}(e);return new De(t)}static fromUint8Array(e){const t=function(i){let o="";for(let a=0;a<i.length;++a)o+=String.fromCharCode(i[a]);return o}(e);return new De(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return function(t){return btoa(t)}(this.binaryString)}toUint8Array(){return function(t){const r=new Uint8Array(t.length);for(let i=0;i<t.length;i++)r[i]=t.charCodeAt(i);return r}(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return J(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}De.EMPTY_BYTE_STRING=new De("");const Hg=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function zt(n){if(ne(!!n,39018),typeof n=="string"){let e=0;const t=Hg.exec(n);if(ne(!!t,46558,{timestamp:n}),t[1]){let i=t[1];i=(i+"000000000").substr(0,9),e=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:pe(n.seconds),nanos:pe(n.nanos)}}function pe(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function Ht(n){return typeof n=="string"?De.fromBase64String(n):De.fromUint8Array(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pl="server_timestamp",Cl="__type__",bl="__previous_value__",kl="__local_write_time__";function Uo(n){var t,r;return((r=(((t=n==null?void 0:n.mapValue)==null?void 0:t.fields)||{})[Cl])==null?void 0:r.stringValue)===Pl}function rs(n){const e=n.mapValue.fields[bl];return Uo(e)?rs(e):e}function kr(n){const e=zt(n.mapValue.fields[kl].timestampValue);return new ce(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gg{constructor(e,t,r,i,o,a,h,f,m,p,w){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=i,this.ssl=o,this.forceLongPolling=a,this.autoDetectLongPolling=h,this.longPollingOptions=f,this.useFetchStreams=m,this.isUsingEmulator=p,this.apiKey=w}}const Bi="(default)";class Vr{constructor(e,t){this.projectId=e,this.database=t||Bi}static empty(){return new Vr("","")}get isDefaultDatabase(){return this.database===Bi}isEqual(e){return e instanceof Vr&&e.projectId===this.projectId&&e.database===this.database}}function Wg(n,e){if(!Object.prototype.hasOwnProperty.apply(n.options,["projectId"]))throw new B(O.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new Vr(n.options.projectId,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vl="__type__",Kg="__max__",_i={mapValue:{}},Dl="__vector__",ji="value";function Gt(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?Uo(n)?4:Jg(n)?9007199254740991:Qg(n)?10:11:q(28295,{value:n})}function dt(n,e){if(n===e)return!0;const t=Gt(n);if(t!==Gt(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return kr(n).isEqual(kr(e));case 3:return function(i,o){if(typeof i.timestampValue=="string"&&typeof o.timestampValue=="string"&&i.timestampValue.length===o.timestampValue.length)return i.timestampValue===o.timestampValue;const a=zt(i.timestampValue),h=zt(o.timestampValue);return a.seconds===h.seconds&&a.nanos===h.nanos}(n,e);case 5:return n.stringValue===e.stringValue;case 6:return function(i,o){return Ht(i.bytesValue).isEqual(Ht(o.bytesValue))}(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return function(i,o){return pe(i.geoPointValue.latitude)===pe(o.geoPointValue.latitude)&&pe(i.geoPointValue.longitude)===pe(o.geoPointValue.longitude)}(n,e);case 2:return function(i,o){if("integerValue"in i&&"integerValue"in o)return pe(i.integerValue)===pe(o.integerValue);if("doubleValue"in i&&"doubleValue"in o){const a=pe(i.doubleValue),h=pe(o.doubleValue);return a===h?Ui(a)===Ui(h):isNaN(a)&&isNaN(h)}return!1}(n,e);case 9:return zn(n.arrayValue.values||[],e.arrayValue.values||[],dt);case 10:case 11:return function(i,o){const a=i.mapValue.fields||{},h=o.mapValue.fields||{};if(Nc(a)!==Nc(h))return!1;for(const f in a)if(a.hasOwnProperty(f)&&(h[f]===void 0||!dt(a[f],h[f])))return!1;return!0}(n,e);default:return q(52216,{left:n})}}function Dr(n,e){return(n.values||[]).find(t=>dt(t,e))!==void 0}function Hn(n,e){if(n===e)return 0;const t=Gt(n),r=Gt(e);if(t!==r)return J(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return J(n.booleanValue,e.booleanValue);case 2:return function(o,a){const h=pe(o.integerValue||o.doubleValue),f=pe(a.integerValue||a.doubleValue);return h<f?-1:h>f?1:h===f?0:isNaN(h)?isNaN(f)?0:-1:1}(n,e);case 3:return Oc(n.timestampValue,e.timestampValue);case 4:return Oc(kr(n),kr(e));case 5:return so(n.stringValue,e.stringValue);case 6:return function(o,a){const h=Ht(o),f=Ht(a);return h.compareTo(f)}(n.bytesValue,e.bytesValue);case 7:return function(o,a){const h=o.split("/"),f=a.split("/");for(let m=0;m<h.length&&m<f.length;m++){const p=J(h[m],f[m]);if(p!==0)return p}return J(h.length,f.length)}(n.referenceValue,e.referenceValue);case 8:return function(o,a){const h=J(pe(o.latitude),pe(a.latitude));return h!==0?h:J(pe(o.longitude),pe(a.longitude))}(n.geoPointValue,e.geoPointValue);case 9:return Mc(n.arrayValue,e.arrayValue);case 10:return function(o,a){var k,N,L,j;const h=o.fields||{},f=a.fields||{},m=(k=h[ji])==null?void 0:k.arrayValue,p=(N=f[ji])==null?void 0:N.arrayValue,w=J(((L=m==null?void 0:m.values)==null?void 0:L.length)||0,((j=p==null?void 0:p.values)==null?void 0:j.length)||0);return w!==0?w:Mc(m,p)}(n.mapValue,e.mapValue);case 11:return function(o,a){if(o===_i.mapValue&&a===_i.mapValue)return 0;if(o===_i.mapValue)return 1;if(a===_i.mapValue)return-1;const h=o.fields||{},f=Object.keys(h),m=a.fields||{},p=Object.keys(m);f.sort(),p.sort();for(let w=0;w<f.length&&w<p.length;++w){const k=so(f[w],p[w]);if(k!==0)return k;const N=Hn(h[f[w]],m[p[w]]);if(N!==0)return N}return J(f.length,p.length)}(n.mapValue,e.mapValue);default:throw q(23264,{he:t})}}function Oc(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return J(n,e);const t=zt(n),r=zt(e),i=J(t.seconds,r.seconds);return i!==0?i:J(t.nanos,r.nanos)}function Mc(n,e){const t=n.values||[],r=e.values||[];for(let i=0;i<t.length&&i<r.length;++i){const o=Hn(t[i],r[i]);if(o)return o}return J(t.length,r.length)}function Gn(n){return oo(n)}function oo(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?function(t){const r=zt(t);return`time(${r.seconds},${r.nanos})`}(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?function(t){return Ht(t).toBase64()}(n.bytesValue):"referenceValue"in n?function(t){return $.fromName(t).toString()}(n.referenceValue):"geoPointValue"in n?function(t){return`geo(${t.latitude},${t.longitude})`}(n.geoPointValue):"arrayValue"in n?function(t){let r="[",i=!0;for(const o of t.values||[])i?i=!1:r+=",",r+=oo(o);return r+"]"}(n.arrayValue):"mapValue"in n?function(t){const r=Object.keys(t.fields||{}).sort();let i="{",o=!0;for(const a of r)o?o=!1:i+=",",i+=`${a}:${oo(t.fields[a])}`;return i+"}"}(n.mapValue):q(61005,{value:n})}function Si(n){switch(Gt(n)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const e=rs(n);return e?16+Si(e):16;case 5:return 2*n.stringValue.length;case 6:return Ht(n.bytesValue).approximateByteSize();case 7:return n.referenceValue.length;case 9:return function(r){return(r.values||[]).reduce((i,o)=>i+Si(o),0)}(n.arrayValue);case 10:case 11:return function(r){let i=0;return Qt(r.fields,(o,a)=>{i+=o.length+Si(a)}),i}(n.mapValue);default:throw q(13486,{value:n})}}function ao(n){return!!n&&"integerValue"in n}function Bo(n){return!!n&&"arrayValue"in n}function Lc(n){return!!n&&"nullValue"in n}function Fc(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function Pi(n){return!!n&&"mapValue"in n}function Qg(n){var t,r;return((r=(((t=n==null?void 0:n.mapValue)==null?void 0:t.fields)||{})[Vl])==null?void 0:r.stringValue)===Dl}function wr(n){if(n.geoPointValue)return{geoPointValue:{...n.geoPointValue}};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:{...n.timestampValue}};if(n.mapValue){const e={mapValue:{fields:{}}};return Qt(n.mapValue.fields,(t,r)=>e.mapValue.fields[t]=wr(r)),e}if(n.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=wr(n.arrayValue.values[t]);return e}return{...n}}function Jg(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue===Kg}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qe{constructor(e){this.value=e}static empty(){return new qe({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!Pi(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=wr(t)}setAll(e){let t=Ve.emptyPath(),r={},i=[];e.forEach((a,h)=>{if(!t.isImmediateParentOf(h)){const f=this.getFieldsMap(t);this.applyChanges(f,r,i),r={},i=[],t=h.popLast()}a?r[h.lastSegment()]=wr(a):i.push(h.lastSegment())});const o=this.getFieldsMap(t);this.applyChanges(o,r,i)}delete(e){const t=this.field(e.popLast());Pi(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return dt(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let i=t.mapValue.fields[e.get(r)];Pi(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=i),t=i}return t.mapValue.fields}applyChanges(e,t,r){Qt(t,(i,o)=>e[i]=o);for(const i of r)delete e[i]}clone(){return new qe(wr(this.value))}}function Nl(n){const e=[];return Qt(n.fields,(t,r)=>{const i=new Ve([t]);if(Pi(r)){const o=Nl(r.mapValue).fields;if(o.length===0)e.push(i);else for(const a of o)e.push(i.child(a))}else e.push(i)}),new He(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fe{constructor(e,t,r,i,o,a,h){this.key=e,this.documentType=t,this.version=r,this.readTime=i,this.createTime=o,this.data=a,this.documentState=h}static newInvalidDocument(e){return new Fe(e,0,H.min(),H.min(),H.min(),qe.empty(),0)}static newFoundDocument(e,t,r,i){return new Fe(e,1,t,H.min(),r,i,0)}static newNoDocument(e,t){return new Fe(e,2,t,H.min(),H.min(),qe.empty(),0)}static newUnknownDocument(e,t){return new Fe(e,3,t,H.min(),H.min(),qe.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(H.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=qe.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=qe.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=H.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof Fe&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new Fe(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $i{constructor(e,t){this.position=e,this.inclusive=t}}function Uc(n,e,t){let r=0;for(let i=0;i<n.position.length;i++){const o=e[i],a=n.position[i];if(o.field.isKeyField()?r=$.comparator($.fromName(a.referenceValue),t.key):r=Hn(a,t.data.field(o.field)),o.dir==="desc"&&(r*=-1),r!==0)break}return r}function Bc(n,e){if(n===null)return e===null;if(e===null||n.inclusive!==e.inclusive||n.position.length!==e.position.length)return!1;for(let t=0;t<n.position.length;t++)if(!dt(n.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qi{constructor(e,t="asc"){this.field=e,this.dir=t}}function Yg(n,e){return n.dir===e.dir&&n.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xl{}class Ie extends xl{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new Zg(e,t,r):t==="array-contains"?new n_(e,r):t==="in"?new r_(e,r):t==="not-in"?new i_(e,r):t==="array-contains-any"?new s_(e,r):new Ie(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new e_(e,r):new t_(e,r)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(Hn(t,this.value)):t!==null&&Gt(this.value)===Gt(t)&&this.matchesComparison(Hn(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return q(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class ft extends xl{constructor(e,t){super(),this.filters=e,this.op=t,this.Pe=null}static create(e,t){return new ft(e,t)}matches(e){return Ol(this)?this.filters.find(t=>!t.matches(e))===void 0:this.filters.find(t=>t.matches(e))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce((e,t)=>e.concat(t.getFlattenedFilters()),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function Ol(n){return n.op==="and"}function Ml(n){return Xg(n)&&Ol(n)}function Xg(n){for(const e of n.filters)if(e instanceof ft)return!1;return!0}function co(n){if(n instanceof Ie)return n.field.canonicalString()+n.op.toString()+Gn(n.value);if(Ml(n))return n.filters.map(e=>co(e)).join(",");{const e=n.filters.map(t=>co(t)).join(",");return`${n.op}(${e})`}}function Ll(n,e){return n instanceof Ie?function(r,i){return i instanceof Ie&&r.op===i.op&&r.field.isEqual(i.field)&&dt(r.value,i.value)}(n,e):n instanceof ft?function(r,i){return i instanceof ft&&r.op===i.op&&r.filters.length===i.filters.length?r.filters.reduce((o,a,h)=>o&&Ll(a,i.filters[h]),!0):!1}(n,e):void q(19439)}function Fl(n){return n instanceof Ie?function(t){return`${t.field.canonicalString()} ${t.op} ${Gn(t.value)}`}(n):n instanceof ft?function(t){return t.op.toString()+" {"+t.getFilters().map(Fl).join(" ,")+"}"}(n):"Filter"}class Zg extends Ie{constructor(e,t,r){super(e,t,r),this.key=$.fromName(r.referenceValue)}matches(e){const t=$.comparator(e.key,this.key);return this.matchesComparison(t)}}class e_ extends Ie{constructor(e,t){super(e,"in",t),this.keys=Ul("in",t)}matches(e){return this.keys.some(t=>t.isEqual(e.key))}}class t_ extends Ie{constructor(e,t){super(e,"not-in",t),this.keys=Ul("not-in",t)}matches(e){return!this.keys.some(t=>t.isEqual(e.key))}}function Ul(n,e){var t;return(((t=e.arrayValue)==null?void 0:t.values)||[]).map(r=>$.fromName(r.referenceValue))}class n_ extends Ie{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return Bo(t)&&Dr(t.arrayValue,this.value)}}class r_ extends Ie{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&Dr(this.value.arrayValue,t)}}class i_ extends Ie{constructor(e,t){super(e,"not-in",t)}matches(e){if(Dr(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!Dr(this.value.arrayValue,t)}}class s_ extends Ie{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!Bo(t)||!t.arrayValue.values)&&t.arrayValue.values.some(r=>Dr(this.value.arrayValue,r))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class o_{constructor(e,t=null,r=[],i=[],o=null,a=null,h=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=i,this.limit=o,this.startAt=a,this.endAt=h,this.Te=null}}function jc(n,e=null,t=[],r=[],i=null,o=null,a=null){return new o_(n,e,t,r,i,o,a)}function jo(n){const e=G(n);if(e.Te===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map(r=>co(r)).join(","),t+="|ob:",t+=e.orderBy.map(r=>function(o){return o.field.canonicalString()+o.dir}(r)).join(","),ns(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map(r=>Gn(r)).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map(r=>Gn(r)).join(",")),e.Te=t}return e.Te}function $o(n,e){if(n.limit!==e.limit||n.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<n.orderBy.length;t++)if(!Yg(n.orderBy[t],e.orderBy[t]))return!1;if(n.filters.length!==e.filters.length)return!1;for(let t=0;t<n.filters.length;t++)if(!Ll(n.filters[t],e.filters[t]))return!1;return n.collectionGroup===e.collectionGroup&&!!n.path.isEqual(e.path)&&!!Bc(n.startAt,e.startAt)&&Bc(n.endAt,e.endAt)}function uo(n){return $.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class is{constructor(e,t=null,r=[],i=[],o=null,a="F",h=null,f=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=i,this.limit=o,this.limitType=a,this.startAt=h,this.endAt=f,this.Ee=null,this.Ie=null,this.Re=null,this.startAt,this.endAt}}function a_(n,e,t,r,i,o,a,h){return new is(n,e,t,r,i,o,a,h)}function qo(n){return new is(n)}function $c(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function c_(n){return $.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}function u_(n){return n.collectionGroup!==null}function vr(n){const e=G(n);if(e.Ee===null){e.Ee=[];const t=new Set;for(const o of e.explicitOrderBy)e.Ee.push(o),t.add(o.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(a){let h=new ve(Ve.comparator);return a.filters.forEach(f=>{f.getFlattenedFilters().forEach(m=>{m.isInequality()&&(h=h.add(m.field))})}),h})(e).forEach(o=>{t.has(o.canonicalString())||o.isKeyField()||e.Ee.push(new qi(o,r))}),t.has(Ve.keyField().canonicalString())||e.Ee.push(new qi(Ve.keyField(),r))}return e.Ee}function at(n){const e=G(n);return e.Ie||(e.Ie=l_(e,vr(n))),e.Ie}function l_(n,e){if(n.limitType==="F")return jc(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map(i=>{const o=i.dir==="desc"?"asc":"desc";return new qi(i.field,o)});const t=n.endAt?new $i(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new $i(n.startAt.position,n.startAt.inclusive):null;return jc(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function lo(n,e,t){return new is(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),e,t,n.startAt,n.endAt)}function ss(n,e){return $o(at(n),at(e))&&n.limitType===e.limitType}function Bl(n){return`${jo(at(n))}|lt:${n.limitType}`}function Nn(n){return`Query(target=${function(t){let r=t.path.canonicalString();return t.collectionGroup!==null&&(r+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(r+=`, filters: [${t.filters.map(i=>Fl(i)).join(", ")}]`),ns(t.limit)||(r+=", limit: "+t.limit),t.orderBy.length>0&&(r+=`, orderBy: [${t.orderBy.map(i=>function(a){return`${a.field.canonicalString()} (${a.dir})`}(i)).join(", ")}]`),t.startAt&&(r+=", startAt: ",r+=t.startAt.inclusive?"b:":"a:",r+=t.startAt.position.map(i=>Gn(i)).join(",")),t.endAt&&(r+=", endAt: ",r+=t.endAt.inclusive?"a:":"b:",r+=t.endAt.position.map(i=>Gn(i)).join(",")),`Target(${r})`}(at(n))}; limitType=${n.limitType})`}function os(n,e){return e.isFoundDocument()&&function(r,i){const o=i.key.path;return r.collectionGroup!==null?i.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(o):$.isDocumentKey(r.path)?r.path.isEqual(o):r.path.isImmediateParentOf(o)}(n,e)&&function(r,i){for(const o of vr(r))if(!o.field.isKeyField()&&i.data.field(o.field)===null)return!1;return!0}(n,e)&&function(r,i){for(const o of r.filters)if(!o.matches(i))return!1;return!0}(n,e)&&function(r,i){return!(r.startAt&&!function(a,h,f){const m=Uc(a,h,f);return a.inclusive?m<=0:m<0}(r.startAt,vr(r),i)||r.endAt&&!function(a,h,f){const m=Uc(a,h,f);return a.inclusive?m>=0:m>0}(r.endAt,vr(r),i))}(n,e)}function h_(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function jl(n){return(e,t)=>{let r=!1;for(const i of vr(n)){const o=d_(i,e,t);if(o!==0)return o;r=r||i.field.isKeyField()}return 0}}function d_(n,e,t){const r=n.field.isKeyField()?$.comparator(e.key,t.key):function(o,a,h){const f=a.data.field(o),m=h.data.field(o);return f!==null&&m!==null?Hn(f,m):q(42886)}(n.field,e,t);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return q(19790,{direction:n.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _n{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r!==void 0){for(const[i,o]of r)if(this.equalsFn(i,e))return o}}has(e){return this.get(e)!==void 0}set(e,t){const r=this.mapKeyFn(e),i=this.inner[r];if(i===void 0)return this.inner[r]=[[e,t]],void this.innerSize++;for(let o=0;o<i.length;o++)if(this.equalsFn(i[o][0],e))return void(i[o]=[e,t]);i.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r===void 0)return!1;for(let i=0;i<r.length;i++)if(this.equalsFn(r[i][0],e))return r.length===1?delete this.inner[t]:r.splice(i,1),this.innerSize--,!0;return!1}forEach(e){Qt(this.inner,(t,r)=>{for(const[i,o]of r)e(i,o)})}isEmpty(){return Rl(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const f_=new de($.comparator);function wt(){return f_}const $l=new de($.comparator);function yr(...n){let e=$l;for(const t of n)e=e.insert(t.key,t);return e}function ql(n){let e=$l;return n.forEach((t,r)=>e=e.insert(t,r.overlayedDocument)),e}function on(){return Ar()}function zl(){return Ar()}function Ar(){return new _n(n=>n.toString(),(n,e)=>n.isEqual(e))}const p_=new de($.comparator),m_=new ve($.comparator);function Y(...n){let e=m_;for(const t of n)e=e.add(t);return e}const g_=new ve(J);function __(){return g_}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function zo(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:Ui(e)?"-0":e}}function Hl(n){return{integerValue:""+n}}function y_(n,e){return $g(e)?Hl(e):zo(n,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class as{constructor(){this._=void 0}}function E_(n,e,t){return n instanceof Nr?function(i,o){const a={fields:{[Cl]:{stringValue:Pl},[kl]:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return o&&Uo(o)&&(o=rs(o)),o&&(a.fields[bl]=o),{mapValue:a}}(t,e):n instanceof xr?Wl(n,e):n instanceof Or?Kl(n,e):function(i,o){const a=Gl(i,o),h=qc(a)+qc(i.Ae);return ao(a)&&ao(i.Ae)?Hl(h):zo(i.serializer,h)}(n,e)}function T_(n,e,t){return n instanceof xr?Wl(n,e):n instanceof Or?Kl(n,e):t}function Gl(n,e){return n instanceof zi?function(r){return ao(r)||function(o){return!!o&&"doubleValue"in o}(r)}(e)?e:{integerValue:0}:null}class Nr extends as{}class xr extends as{constructor(e){super(),this.elements=e}}function Wl(n,e){const t=Ql(e);for(const r of n.elements)t.some(i=>dt(i,r))||t.push(r);return{arrayValue:{values:t}}}class Or extends as{constructor(e){super(),this.elements=e}}function Kl(n,e){let t=Ql(e);for(const r of n.elements)t=t.filter(i=>!dt(i,r));return{arrayValue:{values:t}}}class zi extends as{constructor(e,t){super(),this.serializer=e,this.Ae=t}}function qc(n){return pe(n.integerValue||n.doubleValue)}function Ql(n){return Bo(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class I_{constructor(e,t){this.field=e,this.transform=t}}function w_(n,e){return n.field.isEqual(e.field)&&function(r,i){return r instanceof xr&&i instanceof xr||r instanceof Or&&i instanceof Or?zn(r.elements,i.elements,dt):r instanceof zi&&i instanceof zi?dt(r.Ae,i.Ae):r instanceof Nr&&i instanceof Nr}(n.transform,e.transform)}class v_{constructor(e,t){this.version=e,this.transformResults=t}}class ct{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new ct}static exists(e){return new ct(void 0,e)}static updateTime(e){return new ct(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function Ci(n,e){return n.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(n.updateTime):n.exists===void 0||n.exists===e.isFoundDocument()}class cs{}function Jl(n,e){if(!n.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return n.isNoDocument()?new Xl(n.key,ct.none()):new Hr(n.key,n.data,ct.none());{const t=n.data,r=qe.empty();let i=new ve(Ve.comparator);for(let o of e.fields)if(!i.has(o)){let a=t.field(o);a===null&&o.length>1&&(o=o.popLast(),a=t.field(o)),a===null?r.delete(o):r.set(o,a),i=i.add(o)}return new Jt(n.key,r,new He(i.toArray()),ct.none())}}function A_(n,e,t){n instanceof Hr?function(i,o,a){const h=i.value.clone(),f=Hc(i.fieldTransforms,o,a.transformResults);h.setAll(f),o.convertToFoundDocument(a.version,h).setHasCommittedMutations()}(n,e,t):n instanceof Jt?function(i,o,a){if(!Ci(i.precondition,o))return void o.convertToUnknownDocument(a.version);const h=Hc(i.fieldTransforms,o,a.transformResults),f=o.data;f.setAll(Yl(i)),f.setAll(h),o.convertToFoundDocument(a.version,f).setHasCommittedMutations()}(n,e,t):function(i,o,a){o.convertToNoDocument(a.version).setHasCommittedMutations()}(0,e,t)}function Rr(n,e,t,r){return n instanceof Hr?function(o,a,h,f){if(!Ci(o.precondition,a))return h;const m=o.value.clone(),p=Gc(o.fieldTransforms,f,a);return m.setAll(p),a.convertToFoundDocument(a.version,m).setHasLocalMutations(),null}(n,e,t,r):n instanceof Jt?function(o,a,h,f){if(!Ci(o.precondition,a))return h;const m=Gc(o.fieldTransforms,f,a),p=a.data;return p.setAll(Yl(o)),p.setAll(m),a.convertToFoundDocument(a.version,p).setHasLocalMutations(),h===null?null:h.unionWith(o.fieldMask.fields).unionWith(o.fieldTransforms.map(w=>w.field))}(n,e,t,r):function(o,a,h){return Ci(o.precondition,a)?(a.convertToNoDocument(a.version).setHasLocalMutations(),null):h}(n,e,t)}function R_(n,e){let t=null;for(const r of n.fieldTransforms){const i=e.data.field(r.field),o=Gl(r.transform,i||null);o!=null&&(t===null&&(t=qe.empty()),t.set(r.field,o))}return t||null}function zc(n,e){return n.type===e.type&&!!n.key.isEqual(e.key)&&!!n.precondition.isEqual(e.precondition)&&!!function(r,i){return r===void 0&&i===void 0||!(!r||!i)&&zn(r,i,(o,a)=>w_(o,a))}(n.fieldTransforms,e.fieldTransforms)&&(n.type===0?n.value.isEqual(e.value):n.type!==1||n.data.isEqual(e.data)&&n.fieldMask.isEqual(e.fieldMask))}class Hr extends cs{constructor(e,t,r,i=[]){super(),this.key=e,this.value=t,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class Jt extends cs{constructor(e,t,r,i,o=[]){super(),this.key=e,this.data=t,this.fieldMask=r,this.precondition=i,this.fieldTransforms=o,this.type=1}getFieldMask(){return this.fieldMask}}function Yl(n){const e=new Map;return n.fieldMask.fields.forEach(t=>{if(!t.isEmpty()){const r=n.data.field(t);e.set(t,r)}}),e}function Hc(n,e,t){const r=new Map;ne(n.length===t.length,32656,{Ve:t.length,de:n.length});for(let i=0;i<t.length;i++){const o=n[i],a=o.transform,h=e.data.field(o.field);r.set(o.field,T_(a,h,t[i]))}return r}function Gc(n,e,t){const r=new Map;for(const i of n){const o=i.transform,a=t.data.field(i.field);r.set(i.field,E_(o,a,e))}return r}class Xl extends cs{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class S_ extends cs{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class P_{constructor(e,t,r,i){this.batchId=e,this.localWriteTime=t,this.baseMutations=r,this.mutations=i}applyToRemoteDocument(e,t){const r=t.mutationResults;for(let i=0;i<this.mutations.length;i++){const o=this.mutations[i];o.key.isEqual(e.key)&&A_(o,e,r[i])}}applyToLocalView(e,t){for(const r of this.baseMutations)r.key.isEqual(e.key)&&(t=Rr(r,e,t,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(e.key)&&(t=Rr(r,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const r=zl();return this.mutations.forEach(i=>{const o=e.get(i.key),a=o.overlayedDocument;let h=this.applyToLocalView(a,o.mutatedFields);h=t.has(i.key)?null:h;const f=Jl(a,h);f!==null&&r.set(i.key,f),a.isValidDocument()||a.convertToNoDocument(H.min())}),r}keys(){return this.mutations.reduce((e,t)=>e.add(t.key),Y())}isEqual(e){return this.batchId===e.batchId&&zn(this.mutations,e.mutations,(t,r)=>zc(t,r))&&zn(this.baseMutations,e.baseMutations,(t,r)=>zc(t,r))}}class Ho{constructor(e,t,r,i){this.batch=e,this.commitVersion=t,this.mutationResults=r,this.docVersions=i}static from(e,t,r){ne(e.mutations.length===r.length,58842,{me:e.mutations.length,fe:r.length});let i=function(){return p_}();const o=e.mutations;for(let a=0;a<o.length;a++)i=i.insert(o[a].key,r[a].version);return new Ho(e,t,r,i)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class C_{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class b_{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ge,X;function k_(n){switch(n){case O.OK:return q(64938);case O.CANCELLED:case O.UNKNOWN:case O.DEADLINE_EXCEEDED:case O.RESOURCE_EXHAUSTED:case O.INTERNAL:case O.UNAVAILABLE:case O.UNAUTHENTICATED:return!1;case O.INVALID_ARGUMENT:case O.NOT_FOUND:case O.ALREADY_EXISTS:case O.PERMISSION_DENIED:case O.FAILED_PRECONDITION:case O.ABORTED:case O.OUT_OF_RANGE:case O.UNIMPLEMENTED:case O.DATA_LOSS:return!0;default:return q(15467,{code:n})}}function Zl(n){if(n===void 0)return It("GRPC error has no .code"),O.UNKNOWN;switch(n){case ge.OK:return O.OK;case ge.CANCELLED:return O.CANCELLED;case ge.UNKNOWN:return O.UNKNOWN;case ge.DEADLINE_EXCEEDED:return O.DEADLINE_EXCEEDED;case ge.RESOURCE_EXHAUSTED:return O.RESOURCE_EXHAUSTED;case ge.INTERNAL:return O.INTERNAL;case ge.UNAVAILABLE:return O.UNAVAILABLE;case ge.UNAUTHENTICATED:return O.UNAUTHENTICATED;case ge.INVALID_ARGUMENT:return O.INVALID_ARGUMENT;case ge.NOT_FOUND:return O.NOT_FOUND;case ge.ALREADY_EXISTS:return O.ALREADY_EXISTS;case ge.PERMISSION_DENIED:return O.PERMISSION_DENIED;case ge.FAILED_PRECONDITION:return O.FAILED_PRECONDITION;case ge.ABORTED:return O.ABORTED;case ge.OUT_OF_RANGE:return O.OUT_OF_RANGE;case ge.UNIMPLEMENTED:return O.UNIMPLEMENTED;case ge.DATA_LOSS:return O.DATA_LOSS;default:return q(39323,{code:n})}}(X=ge||(ge={}))[X.OK=0]="OK",X[X.CANCELLED=1]="CANCELLED",X[X.UNKNOWN=2]="UNKNOWN",X[X.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",X[X.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",X[X.NOT_FOUND=5]="NOT_FOUND",X[X.ALREADY_EXISTS=6]="ALREADY_EXISTS",X[X.PERMISSION_DENIED=7]="PERMISSION_DENIED",X[X.UNAUTHENTICATED=16]="UNAUTHENTICATED",X[X.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",X[X.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",X[X.ABORTED=10]="ABORTED",X[X.OUT_OF_RANGE=11]="OUT_OF_RANGE",X[X.UNIMPLEMENTED=12]="UNIMPLEMENTED",X[X.INTERNAL=13]="INTERNAL",X[X.UNAVAILABLE=14]="UNAVAILABLE",X[X.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function V_(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const D_=new jt([4294967295,4294967295],0);function Wc(n){const e=V_().encode(n),t=new ml;return t.update(e),new Uint8Array(t.digest())}function Kc(n){const e=new DataView(n.buffer),t=e.getUint32(0,!0),r=e.getUint32(4,!0),i=e.getUint32(8,!0),o=e.getUint32(12,!0);return[new jt([t,r],0),new jt([i,o],0)]}class Go{constructor(e,t,r){if(this.bitmap=e,this.padding=t,this.hashCount=r,t<0||t>=8)throw new Er(`Invalid padding: ${t}`);if(r<0)throw new Er(`Invalid hash count: ${r}`);if(e.length>0&&this.hashCount===0)throw new Er(`Invalid hash count: ${r}`);if(e.length===0&&t!==0)throw new Er(`Invalid padding when bitmap length is 0: ${t}`);this.ge=8*e.length-t,this.pe=jt.fromNumber(this.ge)}ye(e,t,r){let i=e.add(t.multiply(jt.fromNumber(r)));return i.compare(D_)===1&&(i=new jt([i.getBits(0),i.getBits(1)],0)),i.modulo(this.pe).toNumber()}we(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.ge===0)return!1;const t=Wc(e),[r,i]=Kc(t);for(let o=0;o<this.hashCount;o++){const a=this.ye(r,i,o);if(!this.we(a))return!1}return!0}static create(e,t,r){const i=e%8==0?0:8-e%8,o=new Uint8Array(Math.ceil(e/8)),a=new Go(o,i,t);return r.forEach(h=>a.insert(h)),a}insert(e){if(this.ge===0)return;const t=Wc(e),[r,i]=Kc(t);for(let o=0;o<this.hashCount;o++){const a=this.ye(r,i,o);this.Se(a)}}Se(e){const t=Math.floor(e/8),r=e%8;this.bitmap[t]|=1<<r}}class Er extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class us{constructor(e,t,r,i,o){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=r,this.documentUpdates=i,this.resolvedLimboDocuments=o}static createSynthesizedRemoteEventForCurrentChange(e,t,r){const i=new Map;return i.set(e,Gr.createSynthesizedTargetChangeForCurrentChange(e,t,r)),new us(H.min(),i,new de(J),wt(),Y())}}class Gr{constructor(e,t,r,i,o){this.resumeToken=e,this.current=t,this.addedDocuments=r,this.modifiedDocuments=i,this.removedDocuments=o}static createSynthesizedTargetChangeForCurrentChange(e,t,r){return new Gr(r,t,Y(),Y(),Y())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bi{constructor(e,t,r,i){this.be=e,this.removedTargetIds=t,this.key=r,this.De=i}}class eh{constructor(e,t){this.targetId=e,this.Ce=t}}class th{constructor(e,t,r=De.EMPTY_BYTE_STRING,i=null){this.state=e,this.targetIds=t,this.resumeToken=r,this.cause=i}}class Qc{constructor(){this.ve=0,this.Fe=Jc(),this.Me=De.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(e){e.approximateByteSize()>0&&(this.Oe=!0,this.Me=e)}ke(){let e=Y(),t=Y(),r=Y();return this.Fe.forEach((i,o)=>{switch(o){case 0:e=e.add(i);break;case 2:t=t.add(i);break;case 1:r=r.add(i);break;default:q(38017,{changeType:o})}}),new Gr(this.Me,this.xe,e,t,r)}qe(){this.Oe=!1,this.Fe=Jc()}Ke(e,t){this.Oe=!0,this.Fe=this.Fe.insert(e,t)}Ue(e){this.Oe=!0,this.Fe=this.Fe.remove(e)}$e(){this.ve+=1}We(){this.ve-=1,ne(this.ve>=0,3241,{ve:this.ve})}Qe(){this.Oe=!0,this.xe=!0}}class N_{constructor(e){this.Ge=e,this.ze=new Map,this.je=wt(),this.Je=yi(),this.He=yi(),this.Ze=new de(J)}Xe(e){for(const t of e.be)e.De&&e.De.isFoundDocument()?this.Ye(t,e.De):this.et(t,e.key,e.De);for(const t of e.removedTargetIds)this.et(t,e.key,e.De)}tt(e){this.forEachTarget(e,t=>{const r=this.nt(t);switch(e.state){case 0:this.rt(t)&&r.Le(e.resumeToken);break;case 1:r.We(),r.Ne||r.qe(),r.Le(e.resumeToken);break;case 2:r.We(),r.Ne||this.removeTarget(t);break;case 3:this.rt(t)&&(r.Qe(),r.Le(e.resumeToken));break;case 4:this.rt(t)&&(this.it(t),r.Le(e.resumeToken));break;default:q(56790,{state:e.state})}})}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.ze.forEach((r,i)=>{this.rt(i)&&t(i)})}st(e){const t=e.targetId,r=e.Ce.count,i=this.ot(t);if(i){const o=i.target;if(uo(o))if(r===0){const a=new $(o.path);this.et(t,a,Fe.newNoDocument(a,H.min()))}else ne(r===1,20013,{expectedCount:r});else{const a=this._t(t);if(a!==r){const h=this.ut(e),f=h?this.ct(h,e,a):1;if(f!==0){this.it(t);const m=f===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ze=this.Ze.insert(t,m)}}}}}ut(e){const t=e.Ce.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:r="",padding:i=0},hashCount:o=0}=t;let a,h;try{a=Ht(r).toUint8Array()}catch(f){if(f instanceof Sl)return pn("Decoding the base64 bloom filter in existence filter failed ("+f.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw f}try{h=new Go(a,i,o)}catch(f){return pn(f instanceof Er?"BloomFilter error: ":"Applying bloom filter failed: ",f),null}return h.ge===0?null:h}ct(e,t,r){return t.Ce.count===r-this.Pt(e,t.targetId)?0:2}Pt(e,t){const r=this.Ge.getRemoteKeysForTarget(t);let i=0;return r.forEach(o=>{const a=this.Ge.ht(),h=`projects/${a.projectId}/databases/${a.database}/documents/${o.path.canonicalString()}`;e.mightContain(h)||(this.et(t,o,null),i++)}),i}Tt(e){const t=new Map;this.ze.forEach((o,a)=>{const h=this.ot(a);if(h){if(o.current&&uo(h.target)){const f=new $(h.target.path);this.Et(f).has(a)||this.It(a,f)||this.et(a,f,Fe.newNoDocument(f,e))}o.Be&&(t.set(a,o.ke()),o.qe())}});let r=Y();this.He.forEach((o,a)=>{let h=!0;a.forEachWhile(f=>{const m=this.ot(f);return!m||m.purpose==="TargetPurposeLimboResolution"||(h=!1,!1)}),h&&(r=r.add(o))}),this.je.forEach((o,a)=>a.setReadTime(e));const i=new us(e,t,this.Ze,this.je,r);return this.je=wt(),this.Je=yi(),this.He=yi(),this.Ze=new de(J),i}Ye(e,t){if(!this.rt(e))return;const r=this.It(e,t.key)?2:0;this.nt(e).Ke(t.key,r),this.je=this.je.insert(t.key,t),this.Je=this.Je.insert(t.key,this.Et(t.key).add(e)),this.He=this.He.insert(t.key,this.Rt(t.key).add(e))}et(e,t,r){if(!this.rt(e))return;const i=this.nt(e);this.It(e,t)?i.Ke(t,1):i.Ue(t),this.He=this.He.insert(t,this.Rt(t).delete(e)),this.He=this.He.insert(t,this.Rt(t).add(e)),r&&(this.je=this.je.insert(t,r))}removeTarget(e){this.ze.delete(e)}_t(e){const t=this.nt(e).ke();return this.Ge.getRemoteKeysForTarget(e).size+t.addedDocuments.size-t.removedDocuments.size}$e(e){this.nt(e).$e()}nt(e){let t=this.ze.get(e);return t||(t=new Qc,this.ze.set(e,t)),t}Rt(e){let t=this.He.get(e);return t||(t=new ve(J),this.He=this.He.insert(e,t)),t}Et(e){let t=this.Je.get(e);return t||(t=new ve(J),this.Je=this.Je.insert(e,t)),t}rt(e){const t=this.ot(e)!==null;return t||F("WatchChangeAggregator","Detected inactive target",e),t}ot(e){const t=this.ze.get(e);return t&&t.Ne?null:this.Ge.At(e)}it(e){this.ze.set(e,new Qc),this.Ge.getRemoteKeysForTarget(e).forEach(t=>{this.et(e,t,null)})}It(e,t){return this.Ge.getRemoteKeysForTarget(e).has(t)}}function yi(){return new de($.comparator)}function Jc(){return new de($.comparator)}const x_={asc:"ASCENDING",desc:"DESCENDING"},O_={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},M_={and:"AND",or:"OR"};class L_{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function ho(n,e){return n.useProto3Json||ns(e)?e:{value:e}}function Hi(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function nh(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function F_(n,e){return Hi(n,e.toTimestamp())}function ut(n){return ne(!!n,49232),H.fromTimestamp(function(t){const r=zt(t);return new ce(r.seconds,r.nanos)}(n))}function Wo(n,e){return fo(n,e).canonicalString()}function fo(n,e){const t=function(i){return new he(["projects",i.projectId,"databases",i.database])}(n).child("documents");return e===void 0?t:t.child(e)}function rh(n){const e=he.fromString(n);return ne(ch(e),10190,{key:e.toString()}),e}function po(n,e){return Wo(n.databaseId,e.path)}function zs(n,e){const t=rh(e);if(t.get(1)!==n.databaseId.projectId)throw new B(O.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new B(O.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new $(sh(t))}function ih(n,e){return Wo(n.databaseId,e)}function U_(n){const e=rh(n);return e.length===4?he.emptyPath():sh(e)}function mo(n){return new he(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function sh(n){return ne(n.length>4&&n.get(4)==="documents",29091,{key:n.toString()}),n.popFirst(5)}function Yc(n,e,t){return{name:po(n,e),fields:t.value.mapValue.fields}}function B_(n,e){let t;if("targetChange"in e){e.targetChange;const r=function(m){return m==="NO_CHANGE"?0:m==="ADD"?1:m==="REMOVE"?2:m==="CURRENT"?3:m==="RESET"?4:q(39313,{state:m})}(e.targetChange.targetChangeType||"NO_CHANGE"),i=e.targetChange.targetIds||[],o=function(m,p){return m.useProto3Json?(ne(p===void 0||typeof p=="string",58123),De.fromBase64String(p||"")):(ne(p===void 0||p instanceof pl||p instanceof Uint8Array,16193),De.fromUint8Array(p||new Uint8Array))}(n,e.targetChange.resumeToken),a=e.targetChange.cause,h=a&&function(m){const p=m.code===void 0?O.UNKNOWN:Zl(m.code);return new B(p,m.message||"")}(a);t=new th(r,i,o,h||null)}else if("documentChange"in e){e.documentChange;const r=e.documentChange;r.document,r.document.name,r.document.updateTime;const i=zs(n,r.document.name),o=ut(r.document.updateTime),a=r.document.createTime?ut(r.document.createTime):H.min(),h=new qe({mapValue:{fields:r.document.fields}}),f=Fe.newFoundDocument(i,o,a,h),m=r.targetIds||[],p=r.removedTargetIds||[];t=new bi(m,p,f.key,f)}else if("documentDelete"in e){e.documentDelete;const r=e.documentDelete;r.document;const i=zs(n,r.document),o=r.readTime?ut(r.readTime):H.min(),a=Fe.newNoDocument(i,o),h=r.removedTargetIds||[];t=new bi([],h,a.key,a)}else if("documentRemove"in e){e.documentRemove;const r=e.documentRemove;r.document;const i=zs(n,r.document),o=r.removedTargetIds||[];t=new bi([],o,i,null)}else{if(!("filter"in e))return q(11601,{Vt:e});{e.filter;const r=e.filter;r.targetId;const{count:i=0,unchangedNames:o}=r,a=new b_(i,o),h=r.targetId;t=new eh(h,a)}}return t}function j_(n,e){let t;if(e instanceof Hr)t={update:Yc(n,e.key,e.value)};else if(e instanceof Xl)t={delete:po(n,e.key)};else if(e instanceof Jt)t={update:Yc(n,e.key,e.data),updateMask:J_(e.fieldMask)};else{if(!(e instanceof S_))return q(16599,{dt:e.type});t={verify:po(n,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map(r=>function(o,a){const h=a.transform;if(h instanceof Nr)return{fieldPath:a.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(h instanceof xr)return{fieldPath:a.field.canonicalString(),appendMissingElements:{values:h.elements}};if(h instanceof Or)return{fieldPath:a.field.canonicalString(),removeAllFromArray:{values:h.elements}};if(h instanceof zi)return{fieldPath:a.field.canonicalString(),increment:h.Ae};throw q(20930,{transform:a.transform})}(0,r))),e.precondition.isNone||(t.currentDocument=function(i,o){return o.updateTime!==void 0?{updateTime:F_(i,o.updateTime)}:o.exists!==void 0?{exists:o.exists}:q(27497)}(n,e.precondition)),t}function $_(n,e){return n&&n.length>0?(ne(e!==void 0,14353),n.map(t=>function(i,o){let a=i.updateTime?ut(i.updateTime):ut(o);return a.isEqual(H.min())&&(a=ut(o)),new v_(a,i.transformResults||[])}(t,e))):[]}function q_(n,e){return{documents:[ih(n,e.path)]}}function z_(n,e){const t={structuredQuery:{}},r=e.path;let i;e.collectionGroup!==null?(i=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(i=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=ih(n,i);const o=function(m){if(m.length!==0)return ah(ft.create(m,"and"))}(e.filters);o&&(t.structuredQuery.where=o);const a=function(m){if(m.length!==0)return m.map(p=>function(k){return{field:xn(k.field),direction:W_(k.dir)}}(p))}(e.orderBy);a&&(t.structuredQuery.orderBy=a);const h=ho(n,e.limit);return h!==null&&(t.structuredQuery.limit=h),e.startAt&&(t.structuredQuery.startAt=function(m){return{before:m.inclusive,values:m.position}}(e.startAt)),e.endAt&&(t.structuredQuery.endAt=function(m){return{before:!m.inclusive,values:m.position}}(e.endAt)),{ft:t,parent:i}}function H_(n){let e=U_(n.parent);const t=n.structuredQuery,r=t.from?t.from.length:0;let i=null;if(r>0){ne(r===1,65062);const p=t.from[0];p.allDescendants?i=p.collectionId:e=e.child(p.collectionId)}let o=[];t.where&&(o=function(w){const k=oh(w);return k instanceof ft&&Ml(k)?k.getFilters():[k]}(t.where));let a=[];t.orderBy&&(a=function(w){return w.map(k=>function(L){return new qi(On(L.field),function(U){switch(U){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}}(L.direction))}(k))}(t.orderBy));let h=null;t.limit&&(h=function(w){let k;return k=typeof w=="object"?w.value:w,ns(k)?null:k}(t.limit));let f=null;t.startAt&&(f=function(w){const k=!!w.before,N=w.values||[];return new $i(N,k)}(t.startAt));let m=null;return t.endAt&&(m=function(w){const k=!w.before,N=w.values||[];return new $i(N,k)}(t.endAt)),a_(e,i,a,o,h,"F",f,m)}function G_(n,e){const t=function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return q(28987,{purpose:i})}}(e.purpose);return t==null?null:{"goog-listen-tags":t}}function oh(n){return n.unaryFilter!==void 0?function(t){switch(t.unaryFilter.op){case"IS_NAN":const r=On(t.unaryFilter.field);return Ie.create(r,"==",{doubleValue:NaN});case"IS_NULL":const i=On(t.unaryFilter.field);return Ie.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const o=On(t.unaryFilter.field);return Ie.create(o,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const a=On(t.unaryFilter.field);return Ie.create(a,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return q(61313);default:return q(60726)}}(n):n.fieldFilter!==void 0?function(t){return Ie.create(On(t.fieldFilter.field),function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return q(58110);default:return q(50506)}}(t.fieldFilter.op),t.fieldFilter.value)}(n):n.compositeFilter!==void 0?function(t){return ft.create(t.compositeFilter.filters.map(r=>oh(r)),function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return q(1026)}}(t.compositeFilter.op))}(n):q(30097,{filter:n})}function W_(n){return x_[n]}function K_(n){return O_[n]}function Q_(n){return M_[n]}function xn(n){return{fieldPath:n.canonicalString()}}function On(n){return Ve.fromServerFormat(n.fieldPath)}function ah(n){return n instanceof Ie?function(t){if(t.op==="=="){if(Fc(t.value))return{unaryFilter:{field:xn(t.field),op:"IS_NAN"}};if(Lc(t.value))return{unaryFilter:{field:xn(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(Fc(t.value))return{unaryFilter:{field:xn(t.field),op:"IS_NOT_NAN"}};if(Lc(t.value))return{unaryFilter:{field:xn(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:xn(t.field),op:K_(t.op),value:t.value}}}(n):n instanceof ft?function(t){const r=t.getFilters().map(i=>ah(i));return r.length===1?r[0]:{compositeFilter:{op:Q_(t.op),filters:r}}}(n):q(54877,{filter:n})}function J_(n){const e=[];return n.fields.forEach(t=>e.push(t.canonicalString())),{fieldPaths:e}}function ch(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}function uh(n){return!!n&&typeof n._toProto=="function"&&n._protoValueType==="ProtoValue"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Lt{constructor(e,t,r,i,o=H.min(),a=H.min(),h=De.EMPTY_BYTE_STRING,f=null){this.target=e,this.targetId=t,this.purpose=r,this.sequenceNumber=i,this.snapshotVersion=o,this.lastLimboFreeSnapshotVersion=a,this.resumeToken=h,this.expectedCount=f}withSequenceNumber(e){return new Lt(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new Lt(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new Lt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new Lt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Y_{constructor(e){this.yt=e}}function X_(n){const e=H_({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?lo(e,e.limit,"L"):e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Z_{constructor(){this.bn=new ey}addToCollectionParentIndex(e,t){return this.bn.add(t),x.resolve()}getCollectionParents(e,t){return x.resolve(this.bn.getEntries(t))}addFieldIndex(e,t){return x.resolve()}deleteFieldIndex(e,t){return x.resolve()}deleteAllFieldIndexes(e){return x.resolve()}createTargetIndexes(e,t){return x.resolve()}getDocumentsMatchingTarget(e,t){return x.resolve(null)}getIndexType(e,t){return x.resolve(0)}getFieldIndexes(e,t){return x.resolve([])}getNextCollectionGroupToUpdate(e){return x.resolve(null)}getMinOffset(e,t){return x.resolve(qt.min())}getMinOffsetFromCollectionGroup(e,t){return x.resolve(qt.min())}updateCollectionGroup(e,t,r){return x.resolve()}updateIndexEntries(e,t){return x.resolve()}}class ey{constructor(){this.index={}}add(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t]||new ve(he.comparator),o=!i.has(r);return this.index[t]=i.add(r),o}has(e){const t=e.lastSegment(),r=e.popLast(),i=this.index[t];return i&&i.has(r)}getEntries(e){return(this.index[e]||new ve(he.comparator)).toArray()}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xc={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},lh=41943040;class $e{static withCacheSize(e){return new $e(e,$e.DEFAULT_COLLECTION_PERCENTILE,$e.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,t,r){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */$e.DEFAULT_COLLECTION_PERCENTILE=10,$e.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,$e.DEFAULT=new $e(lh,$e.DEFAULT_COLLECTION_PERCENTILE,$e.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),$e.DISABLED=new $e(-1,0,0);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wn{constructor(e){this.sr=e}next(){return this.sr+=2,this.sr}static _r(){return new Wn(0)}static ar(){return new Wn(-1)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zc="LruGarbageCollector",ty=1048576;function eu([n,e],[t,r]){const i=J(n,t);return i===0?J(e,r):i}class ny{constructor(e){this.Pr=e,this.buffer=new ve(eu),this.Tr=0}Er(){return++this.Tr}Ir(e){const t=[e,this.Er()];if(this.buffer.size<this.Pr)this.buffer=this.buffer.add(t);else{const r=this.buffer.last();eu(t,r)<0&&(this.buffer=this.buffer.delete(r).add(t))}}get maxValue(){return this.buffer.last()[0]}}class ry{constructor(e,t,r){this.garbageCollector=e,this.asyncQueue=t,this.localStore=r,this.Rr=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Ar(6e4)}stop(){this.Rr&&(this.Rr.cancel(),this.Rr=null)}get started(){return this.Rr!==null}Ar(e){F(Zc,`Garbage collection scheduled in ${e}ms`),this.Rr=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,async()=>{this.Rr=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){Zn(t)?F(Zc,"Ignoring IndexedDB error during garbage collection: ",t):await Xn(t)}await this.Ar(3e5)})}}class iy{constructor(e,t){this.Vr=e,this.params=t}calculateTargetCount(e,t){return this.Vr.dr(e).next(r=>Math.floor(t/100*r))}nthSequenceNumber(e,t){if(t===0)return x.resolve(ts.ce);const r=new ny(t);return this.Vr.forEachTarget(e,i=>r.Ir(i.sequenceNumber)).next(()=>this.Vr.mr(e,i=>r.Ir(i))).next(()=>r.maxValue)}removeTargets(e,t,r){return this.Vr.removeTargets(e,t,r)}removeOrphanedDocuments(e,t){return this.Vr.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(F("LruGarbageCollector","Garbage collection skipped; disabled"),x.resolve(Xc)):this.getCacheSize(e).next(r=>r<this.params.cacheSizeCollectionThreshold?(F("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Xc):this.gr(e,t))}getCacheSize(e){return this.Vr.getCacheSize(e)}gr(e,t){let r,i,o,a,h,f,m;const p=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next(w=>(w>this.params.maximumSequenceNumbersToCollect?(F("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${w}`),i=this.params.maximumSequenceNumbersToCollect):i=w,a=Date.now(),this.nthSequenceNumber(e,i))).next(w=>(r=w,h=Date.now(),this.removeTargets(e,r,t))).next(w=>(o=w,f=Date.now(),this.removeOrphanedDocuments(e,r))).next(w=>(m=Date.now(),Dn()<=Q.DEBUG&&F("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${a-p}ms
	Determined least recently used ${i} in `+(h-a)+`ms
	Removed ${o} targets in `+(f-h)+`ms
	Removed ${w} documents in `+(m-f)+`ms
Total Duration: ${m-p}ms`),x.resolve({didRun:!0,sequenceNumbersCollected:i,targetsRemoved:o,documentsRemoved:w})))}}function sy(n,e){return new iy(n,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class oy{constructor(){this.changes=new _n(e=>e.toString(),(e,t)=>e.isEqual(t)),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,Fe.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const r=this.changes.get(t);return r!==void 0?x.resolve(r):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ay{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cy{constructor(e,t,r,i){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=r,this.indexManager=i}getDocument(e,t){let r=null;return this.documentOverlayCache.getOverlay(e,t).next(i=>(r=i,this.remoteDocumentCache.getEntry(e,t))).next(i=>(r!==null&&Rr(r.mutation,i,He.empty(),ce.now()),i))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next(r=>this.getLocalViewOfDocuments(e,r,Y()).next(()=>r))}getLocalViewOfDocuments(e,t,r=Y()){const i=on();return this.populateOverlays(e,i,t).next(()=>this.computeViews(e,t,i,r).next(o=>{let a=yr();return o.forEach((h,f)=>{a=a.insert(h,f.overlayedDocument)}),a}))}getOverlayedDocuments(e,t){const r=on();return this.populateOverlays(e,r,t).next(()=>this.computeViews(e,t,r,Y()))}populateOverlays(e,t,r){const i=[];return r.forEach(o=>{t.has(o)||i.push(o)}),this.documentOverlayCache.getOverlays(e,i).next(o=>{o.forEach((a,h)=>{t.set(a,h)})})}computeViews(e,t,r,i){let o=wt();const a=Ar(),h=function(){return Ar()}();return t.forEach((f,m)=>{const p=r.get(m.key);i.has(m.key)&&(p===void 0||p.mutation instanceof Jt)?o=o.insert(m.key,m):p!==void 0?(a.set(m.key,p.mutation.getFieldMask()),Rr(p.mutation,m,p.mutation.getFieldMask(),ce.now())):a.set(m.key,He.empty())}),this.recalculateAndSaveOverlays(e,o).next(f=>(f.forEach((m,p)=>a.set(m,p)),t.forEach((m,p)=>h.set(m,new ay(p,a.get(m)??null))),h))}recalculateAndSaveOverlays(e,t){const r=Ar();let i=new de((a,h)=>a-h),o=Y();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next(a=>{for(const h of a)h.keys().forEach(f=>{const m=t.get(f);if(m===null)return;let p=r.get(f)||He.empty();p=h.applyToLocalView(m,p),r.set(f,p);const w=(i.get(h.batchId)||Y()).add(f);i=i.insert(h.batchId,w)})}).next(()=>{const a=[],h=i.getReverseIterator();for(;h.hasNext();){const f=h.getNext(),m=f.key,p=f.value,w=zl();p.forEach(k=>{if(!o.has(k)){const N=Jl(t.get(k),r.get(k));N!==null&&w.set(k,N),o=o.add(k)}}),a.push(this.documentOverlayCache.saveOverlays(e,m,w))}return x.waitFor(a)}).next(()=>r)}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next(r=>this.recalculateAndSaveOverlays(e,r))}getDocumentsMatchingQuery(e,t,r,i){return c_(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):u_(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,r,i):this.getDocumentsMatchingCollectionQuery(e,t,r,i)}getNextDocuments(e,t,r,i){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,r,i).next(o=>{const a=i-o.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,r.largestBatchId,i-o.size):x.resolve(on());let h=br,f=o;return a.next(m=>x.forEach(m,(p,w)=>(h<w.largestBatchId&&(h=w.largestBatchId),o.get(p)?x.resolve():this.remoteDocumentCache.getEntry(e,p).next(k=>{f=f.insert(p,k)}))).next(()=>this.populateOverlays(e,m,o)).next(()=>this.computeViews(e,f,m,Y())).next(p=>({batchId:h,changes:ql(p)})))})}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new $(t)).next(r=>{let i=yr();return r.isFoundDocument()&&(i=i.insert(r.key,r)),i})}getDocumentsMatchingCollectionGroupQuery(e,t,r,i){const o=t.collectionGroup;let a=yr();return this.indexManager.getCollectionParents(e,o).next(h=>x.forEach(h,f=>{const m=function(w,k){return new is(k,null,w.explicitOrderBy.slice(),w.filters.slice(),w.limit,w.limitType,w.startAt,w.endAt)}(t,f.child(o));return this.getDocumentsMatchingCollectionQuery(e,m,r,i).next(p=>{p.forEach((w,k)=>{a=a.insert(w,k)})})}).next(()=>a))}getDocumentsMatchingCollectionQuery(e,t,r,i){let o;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,r.largestBatchId).next(a=>(o=a,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,r,o,i))).next(a=>{o.forEach((f,m)=>{const p=m.getKey();a.get(p)===null&&(a=a.insert(p,Fe.newInvalidDocument(p)))});let h=yr();return a.forEach((f,m)=>{const p=o.get(f);p!==void 0&&Rr(p.mutation,m,He.empty(),ce.now()),os(t,m)&&(h=h.insert(f,m))}),h})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uy{constructor(e){this.serializer=e,this.Nr=new Map,this.Br=new Map}getBundleMetadata(e,t){return x.resolve(this.Nr.get(t))}saveBundleMetadata(e,t){return this.Nr.set(t.id,function(i){return{id:i.id,version:i.version,createTime:ut(i.createTime)}}(t)),x.resolve()}getNamedQuery(e,t){return x.resolve(this.Br.get(t))}saveNamedQuery(e,t){return this.Br.set(t.name,function(i){return{name:i.name,query:X_(i.bundledQuery),readTime:ut(i.readTime)}}(t)),x.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ly{constructor(){this.overlays=new de($.comparator),this.Lr=new Map}getOverlay(e,t){return x.resolve(this.overlays.get(t))}getOverlays(e,t){const r=on();return x.forEach(t,i=>this.getOverlay(e,i).next(o=>{o!==null&&r.set(i,o)})).next(()=>r)}saveOverlays(e,t,r){return r.forEach((i,o)=>{this.St(e,t,o)}),x.resolve()}removeOverlaysForBatchId(e,t,r){const i=this.Lr.get(r);return i!==void 0&&(i.forEach(o=>this.overlays=this.overlays.remove(o)),this.Lr.delete(r)),x.resolve()}getOverlaysForCollection(e,t,r){const i=on(),o=t.length+1,a=new $(t.child("")),h=this.overlays.getIteratorFrom(a);for(;h.hasNext();){const f=h.getNext().value,m=f.getKey();if(!t.isPrefixOf(m.path))break;m.path.length===o&&f.largestBatchId>r&&i.set(f.getKey(),f)}return x.resolve(i)}getOverlaysForCollectionGroup(e,t,r,i){let o=new de((m,p)=>m-p);const a=this.overlays.getIterator();for(;a.hasNext();){const m=a.getNext().value;if(m.getKey().getCollectionGroup()===t&&m.largestBatchId>r){let p=o.get(m.largestBatchId);p===null&&(p=on(),o=o.insert(m.largestBatchId,p)),p.set(m.getKey(),m)}}const h=on(),f=o.getIterator();for(;f.hasNext()&&(f.getNext().value.forEach((m,p)=>h.set(m,p)),!(h.size()>=i)););return x.resolve(h)}St(e,t,r){const i=this.overlays.get(r.key);if(i!==null){const a=this.Lr.get(i.largestBatchId).delete(r.key);this.Lr.set(i.largestBatchId,a)}this.overlays=this.overlays.insert(r.key,new C_(t,r));let o=this.Lr.get(t);o===void 0&&(o=Y(),this.Lr.set(t,o)),this.Lr.set(t,o.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hy{constructor(){this.sessionToken=De.EMPTY_BYTE_STRING}getSessionToken(e){return x.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,x.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ko{constructor(){this.kr=new ve(be.qr),this.Kr=new ve(be.Ur)}isEmpty(){return this.kr.isEmpty()}addReference(e,t){const r=new be(e,t);this.kr=this.kr.add(r),this.Kr=this.Kr.add(r)}$r(e,t){e.forEach(r=>this.addReference(r,t))}removeReference(e,t){this.Wr(new be(e,t))}Qr(e,t){e.forEach(r=>this.removeReference(r,t))}Gr(e){const t=new $(new he([])),r=new be(t,e),i=new be(t,e+1),o=[];return this.Kr.forEachInRange([r,i],a=>{this.Wr(a),o.push(a.key)}),o}zr(){this.kr.forEach(e=>this.Wr(e))}Wr(e){this.kr=this.kr.delete(e),this.Kr=this.Kr.delete(e)}jr(e){const t=new $(new he([])),r=new be(t,e),i=new be(t,e+1);let o=Y();return this.Kr.forEachInRange([r,i],a=>{o=o.add(a.key)}),o}containsKey(e){const t=new be(e,0),r=this.kr.firstAfterOrEqual(t);return r!==null&&e.isEqual(r.key)}}class be{constructor(e,t){this.key=e,this.Jr=t}static qr(e,t){return $.comparator(e.key,t.key)||J(e.Jr,t.Jr)}static Ur(e,t){return J(e.Jr,t.Jr)||$.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dy{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.Yn=1,this.Hr=new ve(be.qr)}checkEmpty(e){return x.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,r,i){const o=this.Yn;this.Yn++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const a=new P_(o,t,r,i);this.mutationQueue.push(a);for(const h of i)this.Hr=this.Hr.add(new be(h.key,o)),this.indexManager.addToCollectionParentIndex(e,h.key.path.popLast());return x.resolve(a)}lookupMutationBatch(e,t){return x.resolve(this.Zr(t))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,i=this.Xr(r),o=i<0?0:i;return x.resolve(this.mutationQueue.length>o?this.mutationQueue[o]:null)}getHighestUnacknowledgedBatchId(){return x.resolve(this.mutationQueue.length===0?Fo:this.Yn-1)}getAllMutationBatches(e){return x.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const r=new be(t,0),i=new be(t,Number.POSITIVE_INFINITY),o=[];return this.Hr.forEachInRange([r,i],a=>{const h=this.Zr(a.Jr);o.push(h)}),x.resolve(o)}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new ve(J);return t.forEach(i=>{const o=new be(i,0),a=new be(i,Number.POSITIVE_INFINITY);this.Hr.forEachInRange([o,a],h=>{r=r.add(h.Jr)})}),x.resolve(this.Yr(r))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,i=r.length+1;let o=r;$.isDocumentKey(o)||(o=o.child(""));const a=new be(new $(o),0);let h=new ve(J);return this.Hr.forEachWhile(f=>{const m=f.key.path;return!!r.isPrefixOf(m)&&(m.length===i&&(h=h.add(f.Jr)),!0)},a),x.resolve(this.Yr(h))}Yr(e){const t=[];return e.forEach(r=>{const i=this.Zr(r);i!==null&&t.push(i)}),t}removeMutationBatch(e,t){ne(this.ei(t.batchId,"removed")===0,55003),this.mutationQueue.shift();let r=this.Hr;return x.forEach(t.mutations,i=>{const o=new be(i.key,t.batchId);return r=r.delete(o),this.referenceDelegate.markPotentiallyOrphaned(e,i.key)}).next(()=>{this.Hr=r})}nr(e){}containsKey(e,t){const r=new be(t,0),i=this.Hr.firstAfterOrEqual(r);return x.resolve(t.isEqual(i&&i.key))}performConsistencyCheck(e){return this.mutationQueue.length,x.resolve()}ei(e,t){return this.Xr(e)}Xr(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Zr(e){const t=this.Xr(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fy{constructor(e){this.ti=e,this.docs=function(){return new de($.comparator)}(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const r=t.key,i=this.docs.get(r),o=i?i.size:0,a=this.ti(t);return this.docs=this.docs.insert(r,{document:t.mutableCopy(),size:a}),this.size+=a-o,this.indexManager.addToCollectionParentIndex(e,r.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const r=this.docs.get(t);return x.resolve(r?r.document.mutableCopy():Fe.newInvalidDocument(t))}getEntries(e,t){let r=wt();return t.forEach(i=>{const o=this.docs.get(i);r=r.insert(i,o?o.document.mutableCopy():Fe.newInvalidDocument(i))}),x.resolve(r)}getDocumentsMatchingQuery(e,t,r,i){let o=wt();const a=t.path,h=new $(a.child("__id-9223372036854775808__")),f=this.docs.getIteratorFrom(h);for(;f.hasNext();){const{key:m,value:{document:p}}=f.getNext();if(!a.isPrefixOf(m.path))break;m.path.length>a.length+1||Fg(Lg(p),r)<=0||(i.has(p.key)||os(t,p))&&(o=o.insert(p.key,p.mutableCopy()))}return x.resolve(o)}getAllFromCollectionGroup(e,t,r,i){q(9500)}ni(e,t){return x.forEach(this.docs,r=>t(r))}newChangeBuffer(e){return new py(this)}getSize(e){return x.resolve(this.size)}}class py extends oy{constructor(e){super(),this.Mr=e}applyChanges(e){const t=[];return this.changes.forEach((r,i)=>{i.isValidDocument()?t.push(this.Mr.addEntry(e,i)):this.Mr.removeEntry(r)}),x.waitFor(t)}getFromCache(e,t){return this.Mr.getEntry(e,t)}getAllFromCache(e,t){return this.Mr.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class my{constructor(e){this.persistence=e,this.ri=new _n(t=>jo(t),$o),this.lastRemoteSnapshotVersion=H.min(),this.highestTargetId=0,this.ii=0,this.si=new Ko,this.targetCount=0,this.oi=Wn._r()}forEachTarget(e,t){return this.ri.forEach((r,i)=>t(i)),x.resolve()}getLastRemoteSnapshotVersion(e){return x.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return x.resolve(this.ii)}allocateTargetId(e){return this.highestTargetId=this.oi.next(),x.resolve(this.highestTargetId)}setTargetsMetadata(e,t,r){return r&&(this.lastRemoteSnapshotVersion=r),t>this.ii&&(this.ii=t),x.resolve()}lr(e){this.ri.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this.oi=new Wn(t),this.highestTargetId=t),e.sequenceNumber>this.ii&&(this.ii=e.sequenceNumber)}addTargetData(e,t){return this.lr(t),this.targetCount+=1,x.resolve()}updateTargetData(e,t){return this.lr(t),x.resolve()}removeTargetData(e,t){return this.ri.delete(t.target),this.si.Gr(t.targetId),this.targetCount-=1,x.resolve()}removeTargets(e,t,r){let i=0;const o=[];return this.ri.forEach((a,h)=>{h.sequenceNumber<=t&&r.get(h.targetId)===null&&(this.ri.delete(a),o.push(this.removeMatchingKeysForTargetId(e,h.targetId)),i++)}),x.waitFor(o).next(()=>i)}getTargetCount(e){return x.resolve(this.targetCount)}getTargetData(e,t){const r=this.ri.get(t)||null;return x.resolve(r)}addMatchingKeys(e,t,r){return this.si.$r(t,r),x.resolve()}removeMatchingKeys(e,t,r){this.si.Qr(t,r);const i=this.persistence.referenceDelegate,o=[];return i&&t.forEach(a=>{o.push(i.markPotentiallyOrphaned(e,a))}),x.waitFor(o)}removeMatchingKeysForTargetId(e,t){return this.si.Gr(t),x.resolve()}getMatchingKeysForTargetId(e,t){const r=this.si.jr(t);return x.resolve(r)}containsKey(e,t){return x.resolve(this.si.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hh{constructor(e,t){this._i={},this.overlays={},this.ai=new ts(0),this.ui=!1,this.ui=!0,this.ci=new hy,this.referenceDelegate=e(this),this.li=new my(this),this.indexManager=new Z_,this.remoteDocumentCache=function(i){return new fy(i)}(r=>this.referenceDelegate.hi(r)),this.serializer=new Y_(t),this.Pi=new uy(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.ui=!1,Promise.resolve()}get started(){return this.ui}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new ly,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let r=this._i[e.toKey()];return r||(r=new dy(t,this.referenceDelegate),this._i[e.toKey()]=r),r}getGlobalsCache(){return this.ci}getTargetCache(){return this.li}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Pi}runTransaction(e,t,r){F("MemoryPersistence","Starting transaction:",e);const i=new gy(this.ai.next());return this.referenceDelegate.Ti(),r(i).next(o=>this.referenceDelegate.Ei(i).next(()=>o)).toPromise().then(o=>(i.raiseOnCommittedEvent(),o))}Ii(e,t){return x.or(Object.values(this._i).map(r=>()=>r.containsKey(e,t)))}}class gy extends Bg{constructor(e){super(),this.currentSequenceNumber=e}}class Qo{constructor(e){this.persistence=e,this.Ri=new Ko,this.Ai=null}static Vi(e){return new Qo(e)}get di(){if(this.Ai)return this.Ai;throw q(60996)}addReference(e,t,r){return this.Ri.addReference(r,t),this.di.delete(r.toString()),x.resolve()}removeReference(e,t,r){return this.Ri.removeReference(r,t),this.di.add(r.toString()),x.resolve()}markPotentiallyOrphaned(e,t){return this.di.add(t.toString()),x.resolve()}removeTarget(e,t){this.Ri.Gr(t.targetId).forEach(i=>this.di.add(i.toString()));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(e,t.targetId).next(i=>{i.forEach(o=>this.di.add(o.toString()))}).next(()=>r.removeTargetData(e,t))}Ti(){this.Ai=new Set}Ei(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return x.forEach(this.di,r=>{const i=$.fromPath(r);return this.mi(e,i).next(o=>{o||t.removeEntry(i,H.min())})}).next(()=>(this.Ai=null,t.apply(e)))}updateLimboDocument(e,t){return this.mi(e,t).next(r=>{r?this.di.delete(t.toString()):this.di.add(t.toString())})}hi(e){return 0}mi(e,t){return x.or([()=>x.resolve(this.Ri.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Ii(e,t)])}}class Gi{constructor(e,t){this.persistence=e,this.fi=new _n(r=>qg(r.path),(r,i)=>r.isEqual(i)),this.garbageCollector=sy(this,t)}static Vi(e,t){return new Gi(e,t)}Ti(){}Ei(e){return x.resolve()}forEachTarget(e,t){return this.persistence.getTargetCache().forEachTarget(e,t)}dr(e){const t=this.pr(e);return this.persistence.getTargetCache().getTargetCount(e).next(r=>t.next(i=>r+i))}pr(e){let t=0;return this.mr(e,r=>{t++}).next(()=>t)}mr(e,t){return x.forEach(this.fi,(r,i)=>this.wr(e,r,i).next(o=>o?x.resolve():t(i)))}removeTargets(e,t,r){return this.persistence.getTargetCache().removeTargets(e,t,r)}removeOrphanedDocuments(e,t){let r=0;const i=this.persistence.getRemoteDocumentCache(),o=i.newChangeBuffer();return i.ni(e,a=>this.wr(e,a,t).next(h=>{h||(r++,o.removeEntry(a,H.min()))})).next(()=>o.apply(e)).next(()=>r)}markPotentiallyOrphaned(e,t){return this.fi.set(t,e.currentSequenceNumber),x.resolve()}removeTarget(e,t){const r=t.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,r)}addReference(e,t,r){return this.fi.set(r,e.currentSequenceNumber),x.resolve()}removeReference(e,t,r){return this.fi.set(r,e.currentSequenceNumber),x.resolve()}updateLimboDocument(e,t){return this.fi.set(t,e.currentSequenceNumber),x.resolve()}hi(e){let t=e.key.toString().length;return e.isFoundDocument()&&(t+=Si(e.data.value)),t}wr(e,t,r){return x.or([()=>this.persistence.Ii(e,t),()=>this.persistence.getTargetCache().containsKey(e,t),()=>{const i=this.fi.get(t);return x.resolve(i!==void 0&&i>r)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jo{constructor(e,t,r,i){this.targetId=e,this.fromCache=t,this.Ts=r,this.Es=i}static Is(e,t){let r=Y(),i=Y();for(const o of t.docChanges)switch(o.type){case 0:r=r.add(o.doc.key);break;case 1:i=i.add(o.doc.key)}return new Jo(e,t.fromCache,r,i)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _y{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yy{constructor(){this.Rs=!1,this.As=!1,this.Vs=100,this.ds=function(){return Nd()?8:jg(Ue())>0?6:4}()}initialize(e,t){this.fs=e,this.indexManager=t,this.Rs=!0}getDocumentsMatchingQuery(e,t,r,i){const o={result:null};return this.gs(e,t).next(a=>{o.result=a}).next(()=>{if(!o.result)return this.ps(e,t,i,r).next(a=>{o.result=a})}).next(()=>{if(o.result)return;const a=new _y;return this.ys(e,t,a).next(h=>{if(o.result=h,this.As)return this.ws(e,t,a,h.size)})}).next(()=>o.result)}ws(e,t,r,i){return r.documentReadCount<this.Vs?(Dn()<=Q.DEBUG&&F("QueryEngine","SDK will not create cache indexes for query:",Nn(t),"since it only creates cache indexes for collection contains","more than or equal to",this.Vs,"documents"),x.resolve()):(Dn()<=Q.DEBUG&&F("QueryEngine","Query:",Nn(t),"scans",r.documentReadCount,"local documents and returns",i,"documents as results."),r.documentReadCount>this.ds*i?(Dn()<=Q.DEBUG&&F("QueryEngine","The SDK decides to create cache indexes for query:",Nn(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,at(t))):x.resolve())}gs(e,t){if($c(t))return x.resolve(null);let r=at(t);return this.indexManager.getIndexType(e,r).next(i=>i===0?null:(t.limit!==null&&i===1&&(t=lo(t,null,"F"),r=at(t)),this.indexManager.getDocumentsMatchingTarget(e,r).next(o=>{const a=Y(...o);return this.fs.getDocuments(e,a).next(h=>this.indexManager.getMinOffset(e,r).next(f=>{const m=this.Ss(t,h);return this.bs(t,m,a,f.readTime)?this.gs(e,lo(t,null,"F")):this.Ds(e,m,t,f)}))})))}ps(e,t,r,i){return $c(t)||i.isEqual(H.min())?x.resolve(null):this.fs.getDocuments(e,r).next(o=>{const a=this.Ss(t,o);return this.bs(t,a,r,i)?x.resolve(null):(Dn()<=Q.DEBUG&&F("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),Nn(t)),this.Ds(e,a,t,Mg(i,br)).next(h=>h))})}Ss(e,t){let r=new ve(jl(e));return t.forEach((i,o)=>{os(e,o)&&(r=r.add(o))}),r}bs(e,t,r,i){if(e.limit===null)return!1;if(r.size!==t.size)return!0;const o=e.limitType==="F"?t.last():t.first();return!!o&&(o.hasPendingWrites||o.version.compareTo(i)>0)}ys(e,t,r){return Dn()<=Q.DEBUG&&F("QueryEngine","Using full collection scan to execute query:",Nn(t)),this.fs.getDocumentsMatchingQuery(e,t,qt.min(),r)}Ds(e,t,r,i){return this.fs.getDocumentsMatchingQuery(e,r,i).next(o=>(t.forEach(a=>{o=o.insert(a.key,a)}),o))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Yo="LocalStore",Ey=3e8;class Ty{constructor(e,t,r,i){this.persistence=e,this.Cs=t,this.serializer=i,this.vs=new de(J),this.Fs=new _n(o=>jo(o),$o),this.Ms=new Map,this.xs=e.getRemoteDocumentCache(),this.li=e.getTargetCache(),this.Pi=e.getBundleCache(),this.Os(r)}Os(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new cy(this.xs,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.xs.setIndexManager(this.indexManager),this.Cs.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",t=>e.collect(t,this.vs))}}function Iy(n,e,t,r){return new Ty(n,e,t,r)}async function dh(n,e){const t=G(n);return await t.persistence.runTransaction("Handle user change","readonly",r=>{let i;return t.mutationQueue.getAllMutationBatches(r).next(o=>(i=o,t.Os(e),t.mutationQueue.getAllMutationBatches(r))).next(o=>{const a=[],h=[];let f=Y();for(const m of i){a.push(m.batchId);for(const p of m.mutations)f=f.add(p.key)}for(const m of o){h.push(m.batchId);for(const p of m.mutations)f=f.add(p.key)}return t.localDocuments.getDocuments(r,f).next(m=>({Ns:m,removedBatchIds:a,addedBatchIds:h}))})})}function wy(n,e){const t=G(n);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",r=>{const i=e.batch.keys(),o=t.xs.newChangeBuffer({trackRemovals:!0});return function(h,f,m,p){const w=m.batch,k=w.keys();let N=x.resolve();return k.forEach(L=>{N=N.next(()=>p.getEntry(f,L)).next(j=>{const U=m.docVersions.get(L);ne(U!==null,48541),j.version.compareTo(U)<0&&(w.applyToRemoteDocument(j,m),j.isValidDocument()&&(j.setReadTime(m.commitVersion),p.addEntry(j)))})}),N.next(()=>h.mutationQueue.removeMutationBatch(f,w))}(t,r,e,o).next(()=>o.apply(r)).next(()=>t.mutationQueue.performConsistencyCheck(r)).next(()=>t.documentOverlayCache.removeOverlaysForBatchId(r,i,e.batch.batchId)).next(()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,function(h){let f=Y();for(let m=0;m<h.mutationResults.length;++m)h.mutationResults[m].transformResults.length>0&&(f=f.add(h.batch.mutations[m].key));return f}(e))).next(()=>t.localDocuments.getDocuments(r,i))})}function fh(n){const e=G(n);return e.persistence.runTransaction("Get last remote snapshot version","readonly",t=>e.li.getLastRemoteSnapshotVersion(t))}function vy(n,e){const t=G(n),r=e.snapshotVersion;let i=t.vs;return t.persistence.runTransaction("Apply remote event","readwrite-primary",o=>{const a=t.xs.newChangeBuffer({trackRemovals:!0});i=t.vs;const h=[];e.targetChanges.forEach((p,w)=>{const k=i.get(w);if(!k)return;h.push(t.li.removeMatchingKeys(o,p.removedDocuments,w).next(()=>t.li.addMatchingKeys(o,p.addedDocuments,w)));let N=k.withSequenceNumber(o.currentSequenceNumber);e.targetMismatches.get(w)!==null?N=N.withResumeToken(De.EMPTY_BYTE_STRING,H.min()).withLastLimboFreeSnapshotVersion(H.min()):p.resumeToken.approximateByteSize()>0&&(N=N.withResumeToken(p.resumeToken,r)),i=i.insert(w,N),function(j,U,ee){return j.resumeToken.approximateByteSize()===0||U.snapshotVersion.toMicroseconds()-j.snapshotVersion.toMicroseconds()>=Ey?!0:ee.addedDocuments.size+ee.modifiedDocuments.size+ee.removedDocuments.size>0}(k,N,p)&&h.push(t.li.updateTargetData(o,N))});let f=wt(),m=Y();if(e.documentUpdates.forEach(p=>{e.resolvedLimboDocuments.has(p)&&h.push(t.persistence.referenceDelegate.updateLimboDocument(o,p))}),h.push(Ay(o,a,e.documentUpdates).next(p=>{f=p.Bs,m=p.Ls})),!r.isEqual(H.min())){const p=t.li.getLastRemoteSnapshotVersion(o).next(w=>t.li.setTargetsMetadata(o,o.currentSequenceNumber,r));h.push(p)}return x.waitFor(h).next(()=>a.apply(o)).next(()=>t.localDocuments.getLocalViewOfDocuments(o,f,m)).next(()=>f)}).then(o=>(t.vs=i,o))}function Ay(n,e,t){let r=Y(),i=Y();return t.forEach(o=>r=r.add(o)),e.getEntries(n,r).next(o=>{let a=wt();return t.forEach((h,f)=>{const m=o.get(h);f.isFoundDocument()!==m.isFoundDocument()&&(i=i.add(h)),f.isNoDocument()&&f.version.isEqual(H.min())?(e.removeEntry(h,f.readTime),a=a.insert(h,f)):!m.isValidDocument()||f.version.compareTo(m.version)>0||f.version.compareTo(m.version)===0&&m.hasPendingWrites?(e.addEntry(f),a=a.insert(h,f)):F(Yo,"Ignoring outdated watch update for ",h,". Current version:",m.version," Watch version:",f.version)}),{Bs:a,Ls:i}})}function Ry(n,e){const t=G(n);return t.persistence.runTransaction("Get next mutation batch","readonly",r=>(e===void 0&&(e=Fo),t.mutationQueue.getNextMutationBatchAfterBatchId(r,e)))}function Sy(n,e){const t=G(n);return t.persistence.runTransaction("Allocate target","readwrite",r=>{let i;return t.li.getTargetData(r,e).next(o=>o?(i=o,x.resolve(i)):t.li.allocateTargetId(r).next(a=>(i=new Lt(e,a,"TargetPurposeListen",r.currentSequenceNumber),t.li.addTargetData(r,i).next(()=>i))))}).then(r=>{const i=t.vs.get(r.targetId);return(i===null||r.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(t.vs=t.vs.insert(r.targetId,r),t.Fs.set(e,r.targetId)),r})}async function go(n,e,t){const r=G(n),i=r.vs.get(e),o=t?"readwrite":"readwrite-primary";try{t||await r.persistence.runTransaction("Release target",o,a=>r.persistence.referenceDelegate.removeTarget(a,i))}catch(a){if(!Zn(a))throw a;F(Yo,`Failed to update sequence numbers for target ${e}: ${a}`)}r.vs=r.vs.remove(e),r.Fs.delete(i.target)}function tu(n,e,t){const r=G(n);let i=H.min(),o=Y();return r.persistence.runTransaction("Execute query","readwrite",a=>function(f,m,p){const w=G(f),k=w.Fs.get(p);return k!==void 0?x.resolve(w.vs.get(k)):w.li.getTargetData(m,p)}(r,a,at(e)).next(h=>{if(h)return i=h.lastLimboFreeSnapshotVersion,r.li.getMatchingKeysForTargetId(a,h.targetId).next(f=>{o=f})}).next(()=>r.Cs.getDocumentsMatchingQuery(a,e,t?i:H.min(),t?o:Y())).next(h=>(Py(r,h_(e),h),{documents:h,ks:o})))}function Py(n,e,t){let r=n.Ms.get(e)||H.min();t.forEach((i,o)=>{o.readTime.compareTo(r)>0&&(r=o.readTime)}),n.Ms.set(e,r)}class nu{constructor(){this.activeTargetIds=__()}Qs(e){this.activeTargetIds=this.activeTargetIds.add(e)}Gs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}Ws(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class Cy{constructor(){this.vo=new nu,this.Fo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,r){}addLocalQueryTarget(e,t=!0){return t&&this.vo.Qs(e),this.Fo[e]||"not-current"}updateQueryState(e,t,r){this.Fo[e]=t}removeLocalQueryTarget(e){this.vo.Gs(e)}isLocalQueryTarget(e){return this.vo.activeTargetIds.has(e)}clearQueryState(e){delete this.Fo[e]}getAllActiveQueryTargets(){return this.vo.activeTargetIds}isActiveQueryTarget(e){return this.vo.activeTargetIds.has(e)}start(){return this.vo=new nu,Promise.resolve()}handleUserChange(e,t,r){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class by{Mo(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ru="ConnectivityMonitor";class iu{constructor(){this.xo=()=>this.Oo(),this.No=()=>this.Bo(),this.Lo=[],this.ko()}Mo(e){this.Lo.push(e)}shutdown(){window.removeEventListener("online",this.xo),window.removeEventListener("offline",this.No)}ko(){window.addEventListener("online",this.xo),window.addEventListener("offline",this.No)}Oo(){F(ru,"Network connectivity changed: AVAILABLE");for(const e of this.Lo)e(0)}Bo(){F(ru,"Network connectivity changed: UNAVAILABLE");for(const e of this.Lo)e(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ei=null;function _o(){return Ei===null?Ei=function(){return 268435456+Math.round(2147483648*Math.random())}():Ei++,"0x"+Ei.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hs="RestConnection",ky={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery",ExecutePipeline:"executePipeline"};class Vy{get qo(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const t=e.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),i=encodeURIComponent(this.databaseId.database);this.Ko=t+"://"+e.host,this.Uo=`projects/${r}/databases/${i}`,this.$o=this.databaseId.database===Bi?`project_id=${r}`:`project_id=${r}&database_id=${i}`}Wo(e,t,r,i,o){const a=_o(),h=this.Qo(e,t.toUriEncodedString());F(Hs,`Sending RPC '${e}' ${a}:`,h,r);const f={"google-cloud-resource-prefix":this.Uo,"x-goog-request-params":this.$o};this.Go(f,i,o);const{host:m}=new URL(h),p=Br(m);return this.zo(e,h,f,r,p).then(w=>(F(Hs,`Received RPC '${e}' ${a}: `,w),w),w=>{throw pn(Hs,`RPC '${e}' ${a} failed with error: `,w,"url: ",h,"request:",r),w})}jo(e,t,r,i,o,a){return this.Wo(e,t,r,i,o)}Go(e,t,r){e["X-Goog-Api-Client"]=function(){return"gl-js/ fire/"+Yn}(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach((i,o)=>e[o]=i),r&&r.headers.forEach((i,o)=>e[o]=i)}Qo(e,t){const r=ky[e];let i=`${this.Ko}/v1/${t}:${r}`;return this.databaseInfo.apiKey&&(i=`${i}?key=${encodeURIComponent(this.databaseInfo.apiKey)}`),i}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Dy{constructor(e){this.Jo=e.Jo,this.Ho=e.Ho}Zo(e){this.Xo=e}Yo(e){this.e_=e}t_(e){this.n_=e}onMessage(e){this.r_=e}close(){this.Ho()}send(e){this.Jo(e)}i_(){this.Xo()}s_(){this.e_()}o_(e){this.n_(e)}__(e){this.r_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Me="WebChannelConnection",gr=(n,e,t)=>{n.listen(e,r=>{try{t(r)}catch(i){setTimeout(()=>{throw i},0)}})};class Bn extends Vy{constructor(e){super(e),this.a_=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}static u_(){if(!Bn.c_){const e=El();gr(e,yl.STAT_EVENT,t=>{t.stat===io.PROXY?F(Me,"STAT_EVENT: detected buffering proxy"):t.stat===io.NOPROXY&&F(Me,"STAT_EVENT: detected no buffering proxy")}),Bn.c_=!0}}zo(e,t,r,i,o){const a=_o();return new Promise((h,f)=>{const m=new gl;m.setWithCredentials(!0),m.listenOnce(_l.COMPLETE,()=>{try{switch(m.getLastErrorCode()){case Ri.NO_ERROR:const w=m.getResponseJson();F(Me,`XHR for RPC '${e}' ${a} received:`,JSON.stringify(w)),h(w);break;case Ri.TIMEOUT:F(Me,`RPC '${e}' ${a} timed out`),f(new B(O.DEADLINE_EXCEEDED,"Request time out"));break;case Ri.HTTP_ERROR:const k=m.getStatus();if(F(Me,`RPC '${e}' ${a} failed with status:`,k,"response text:",m.getResponseText()),k>0){let N=m.getResponseJson();Array.isArray(N)&&(N=N[0]);const L=N==null?void 0:N.error;if(L&&L.status&&L.message){const j=function(ee){const Z=ee.toLowerCase().replace(/_/g,"-");return Object.values(O).indexOf(Z)>=0?Z:O.UNKNOWN}(L.status);f(new B(j,L.message))}else f(new B(O.UNKNOWN,"Server responded with status "+m.getStatus()))}else f(new B(O.UNAVAILABLE,"Connection failed."));break;default:q(9055,{l_:e,streamId:a,h_:m.getLastErrorCode(),P_:m.getLastError()})}}finally{F(Me,`RPC '${e}' ${a} completed.`)}});const p=JSON.stringify(i);F(Me,`RPC '${e}' ${a} sending request:`,i),m.send(t,"POST",p,r,15)})}T_(e,t,r){const i=_o(),o=[this.Ko,"/","google.firestore.v1.Firestore","/",e,"/channel"],a=this.createWebChannelTransport(),h={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},f=this.longPollingOptions.timeoutSeconds;f!==void 0&&(h.longPollingTimeout=Math.round(1e3*f)),this.useFetchStreams&&(h.useFetchStreams=!0),this.Go(h.initMessageHeaders,t,r),h.encodeInitMessageHeaders=!0;const m=o.join("");F(Me,`Creating RPC '${e}' stream ${i}: ${m}`,h);const p=a.createWebChannel(m,h);this.E_(p);let w=!1,k=!1;const N=new Dy({Jo:L=>{k?F(Me,`Not sending because RPC '${e}' stream ${i} is closed:`,L):(w||(F(Me,`Opening RPC '${e}' stream ${i} transport.`),p.open(),w=!0),F(Me,`RPC '${e}' stream ${i} sending:`,L),p.send(L))},Ho:()=>p.close()});return gr(p,_r.EventType.OPEN,()=>{k||(F(Me,`RPC '${e}' stream ${i} transport opened.`),N.i_())}),gr(p,_r.EventType.CLOSE,()=>{k||(k=!0,F(Me,`RPC '${e}' stream ${i} transport closed`),N.o_(),this.I_(p))}),gr(p,_r.EventType.ERROR,L=>{k||(k=!0,pn(Me,`RPC '${e}' stream ${i} transport errored. Name:`,L.name,"Message:",L.message),N.o_(new B(O.UNAVAILABLE,"The operation could not be completed")))}),gr(p,_r.EventType.MESSAGE,L=>{var j;if(!k){const U=L.data[0];ne(!!U,16349);const ee=U,Z=(ee==null?void 0:ee.error)||((j=ee[0])==null?void 0:j.error);if(Z){F(Me,`RPC '${e}' stream ${i} received error:`,Z);const ue=Z.status;let Ne=function(R){const E=ge[R];if(E!==void 0)return Zl(E)}(ue),Re=Z.message;ue==="NOT_FOUND"&&Re.includes("database")&&Re.includes("does not exist")&&Re.includes(this.databaseId.database)&&pn(`Database '${this.databaseId.database}' not found. Please check your project configuration.`),Ne===void 0&&(Ne=O.INTERNAL,Re="Unknown error status: "+ue+" with message "+Z.message),k=!0,N.o_(new B(Ne,Re)),p.close()}else F(Me,`RPC '${e}' stream ${i} received:`,U),N.__(U)}}),Bn.u_(),setTimeout(()=>{N.s_()},0),N}terminate(){this.a_.forEach(e=>e.close()),this.a_=[]}E_(e){this.a_.push(e)}I_(e){this.a_=this.a_.filter(t=>t===e)}Go(e,t,r){super.Go(e,t,r),this.databaseInfo.apiKey&&(e["x-goog-api-key"]=this.databaseInfo.apiKey)}createWebChannelTransport(){return Tl()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ny(n){return new Bn(n)}function Gs(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ls(n){return new L_(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Bn.c_=!1;class ph{constructor(e,t,r=1e3,i=1.5,o=6e4){this.Ci=e,this.timerId=t,this.R_=r,this.A_=i,this.V_=o,this.d_=0,this.m_=null,this.f_=Date.now(),this.reset()}reset(){this.d_=0}g_(){this.d_=this.V_}p_(e){this.cancel();const t=Math.floor(this.d_+this.y_()),r=Math.max(0,Date.now()-this.f_),i=Math.max(0,t-r);i>0&&F("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.d_} ms, delay with jitter: ${t} ms, last attempt: ${r} ms ago)`),this.m_=this.Ci.enqueueAfterDelay(this.timerId,i,()=>(this.f_=Date.now(),e())),this.d_*=this.A_,this.d_<this.R_&&(this.d_=this.R_),this.d_>this.V_&&(this.d_=this.V_)}w_(){this.m_!==null&&(this.m_.skipDelay(),this.m_=null)}cancel(){this.m_!==null&&(this.m_.cancel(),this.m_=null)}y_(){return(Math.random()-.5)*this.d_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const su="PersistentStream";class mh{constructor(e,t,r,i,o,a,h,f){this.Ci=e,this.S_=r,this.b_=i,this.connection=o,this.authCredentialsProvider=a,this.appCheckCredentialsProvider=h,this.listener=f,this.state=0,this.D_=0,this.C_=null,this.v_=null,this.stream=null,this.F_=0,this.M_=new ph(e,t)}x_(){return this.state===1||this.state===5||this.O_()}O_(){return this.state===2||this.state===3}start(){this.F_=0,this.state!==4?this.auth():this.N_()}async stop(){this.x_()&&await this.close(0)}B_(){this.state=0,this.M_.reset()}L_(){this.O_()&&this.C_===null&&(this.C_=this.Ci.enqueueAfterDelay(this.S_,6e4,()=>this.k_()))}q_(e){this.K_(),this.stream.send(e)}async k_(){if(this.O_())return this.close(0)}K_(){this.C_&&(this.C_.cancel(),this.C_=null)}U_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(e,t){this.K_(),this.U_(),this.M_.cancel(),this.D_++,e!==4?this.M_.reset():t&&t.code===O.RESOURCE_EXHAUSTED?(It(t.toString()),It("Using maximum backoff delay to prevent overloading the backend."),this.M_.g_()):t&&t.code===O.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.W_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.t_(t)}W_(){}auth(){this.state=1;const e=this.Q_(this.D_),t=this.D_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then(([r,i])=>{this.D_===t&&this.G_(r,i)},r=>{e(()=>{const i=new B(O.UNKNOWN,"Fetching auth token failed: "+r.message);return this.z_(i)})})}G_(e,t){const r=this.Q_(this.D_);this.stream=this.j_(e,t),this.stream.Zo(()=>{r(()=>this.listener.Zo())}),this.stream.Yo(()=>{r(()=>(this.state=2,this.v_=this.Ci.enqueueAfterDelay(this.b_,1e4,()=>(this.O_()&&(this.state=3),Promise.resolve())),this.listener.Yo()))}),this.stream.t_(i=>{r(()=>this.z_(i))}),this.stream.onMessage(i=>{r(()=>++this.F_==1?this.J_(i):this.onNext(i))})}N_(){this.state=5,this.M_.p_(async()=>{this.state=0,this.start()})}z_(e){return F(su,`close with error: ${e}`),this.stream=null,this.close(4,e)}Q_(e){return t=>{this.Ci.enqueueAndForget(()=>this.D_===e?t():(F(su,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve()))}}}class xy extends mh{constructor(e,t,r,i,o,a){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,r,i,a),this.serializer=o}j_(e,t){return this.connection.T_("Listen",e,t)}J_(e){return this.onNext(e)}onNext(e){this.M_.reset();const t=B_(this.serializer,e),r=function(o){if(!("targetChange"in o))return H.min();const a=o.targetChange;return a.targetIds&&a.targetIds.length?H.min():a.readTime?ut(a.readTime):H.min()}(e);return this.listener.H_(t,r)}Z_(e){const t={};t.database=mo(this.serializer),t.addTarget=function(o,a){let h;const f=a.target;if(h=uo(f)?{documents:q_(o,f)}:{query:z_(o,f).ft},h.targetId=a.targetId,a.resumeToken.approximateByteSize()>0){h.resumeToken=nh(o,a.resumeToken);const m=ho(o,a.expectedCount);m!==null&&(h.expectedCount=m)}else if(a.snapshotVersion.compareTo(H.min())>0){h.readTime=Hi(o,a.snapshotVersion.toTimestamp());const m=ho(o,a.expectedCount);m!==null&&(h.expectedCount=m)}return h}(this.serializer,e);const r=G_(this.serializer,e);r&&(t.labels=r),this.q_(t)}X_(e){const t={};t.database=mo(this.serializer),t.removeTarget=e,this.q_(t)}}class Oy extends mh{constructor(e,t,r,i,o,a){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,r,i,a),this.serializer=o}get Y_(){return this.F_>0}start(){this.lastStreamToken=void 0,super.start()}W_(){this.Y_&&this.ea([])}j_(e,t){return this.connection.T_("Write",e,t)}J_(e){return ne(!!e.streamToken,31322),this.lastStreamToken=e.streamToken,ne(!e.writeResults||e.writeResults.length===0,55816),this.listener.ta()}onNext(e){ne(!!e.streamToken,12678),this.lastStreamToken=e.streamToken,this.M_.reset();const t=$_(e.writeResults,e.commitTime),r=ut(e.commitTime);return this.listener.na(r,t)}ra(){const e={};e.database=mo(this.serializer),this.q_(e)}ea(e){const t={streamToken:this.lastStreamToken,writes:e.map(r=>j_(this.serializer,r))};this.q_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class My{}class Ly extends My{constructor(e,t,r,i){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=i,this.ia=!1}sa(){if(this.ia)throw new B(O.FAILED_PRECONDITION,"The client has already been terminated.")}Wo(e,t,r,i){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([o,a])=>this.connection.Wo(e,fo(t,r),i,o,a)).catch(o=>{throw o.name==="FirebaseError"?(o.code===O.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new B(O.UNKNOWN,o.toString())})}jo(e,t,r,i,o){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([a,h])=>this.connection.jo(e,fo(t,r),i,a,h,o)).catch(a=>{throw a.name==="FirebaseError"?(a.code===O.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),a):new B(O.UNKNOWN,a.toString())})}terminate(){this.ia=!0,this.connection.terminate()}}function Fy(n,e,t,r){return new Ly(n,e,t,r)}class Uy{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.oa=0,this._a=null,this.aa=!0}ua(){this.oa===0&&(this.ca("Unknown"),this._a=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,()=>(this._a=null,this.la("Backend didn't respond within 10 seconds."),this.ca("Offline"),Promise.resolve())))}ha(e){this.state==="Online"?this.ca("Unknown"):(this.oa++,this.oa>=1&&(this.Pa(),this.la(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ca("Offline")))}set(e){this.Pa(),this.oa=0,e==="Online"&&(this.aa=!1),this.ca(e)}ca(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}la(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.aa?(It(t),this.aa=!1):F("OnlineStateTracker",t)}Pa(){this._a!==null&&(this._a.cancel(),this._a=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gn="RemoteStore";class By{constructor(e,t,r,i,o){this.localStore=e,this.datastore=t,this.asyncQueue=r,this.remoteSyncer={},this.Ta=[],this.Ea=new Map,this.Ia=new Set,this.Ra=[],this.Aa=o,this.Aa.Mo(a=>{r.enqueueAndForget(async()=>{yn(this)&&(F(gn,"Restarting streams for network reachability change."),await async function(f){const m=G(f);m.Ia.add(4),await Wr(m),m.Va.set("Unknown"),m.Ia.delete(4),await hs(m)}(this))})}),this.Va=new Uy(r,i)}}async function hs(n){if(yn(n))for(const e of n.Ra)await e(!0)}async function Wr(n){for(const e of n.Ra)await e(!1)}function gh(n,e){const t=G(n);t.Ea.has(e.targetId)||(t.Ea.set(e.targetId,e),ta(t)?ea(t):er(t).O_()&&Zo(t,e))}function Xo(n,e){const t=G(n),r=er(t);t.Ea.delete(e),r.O_()&&_h(t,e),t.Ea.size===0&&(r.O_()?r.L_():yn(t)&&t.Va.set("Unknown"))}function Zo(n,e){if(n.da.$e(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(H.min())>0){const t=n.remoteSyncer.getRemoteKeysForTarget(e.targetId).size;e=e.withExpectedCount(t)}er(n).Z_(e)}function _h(n,e){n.da.$e(e),er(n).X_(e)}function ea(n){n.da=new N_({getRemoteKeysForTarget:e=>n.remoteSyncer.getRemoteKeysForTarget(e),At:e=>n.Ea.get(e)||null,ht:()=>n.datastore.serializer.databaseId}),er(n).start(),n.Va.ua()}function ta(n){return yn(n)&&!er(n).x_()&&n.Ea.size>0}function yn(n){return G(n).Ia.size===0}function yh(n){n.da=void 0}async function jy(n){n.Va.set("Online")}async function $y(n){n.Ea.forEach((e,t)=>{Zo(n,e)})}async function qy(n,e){yh(n),ta(n)?(n.Va.ha(e),ea(n)):n.Va.set("Unknown")}async function zy(n,e,t){if(n.Va.set("Online"),e instanceof th&&e.state===2&&e.cause)try{await async function(i,o){const a=o.cause;for(const h of o.targetIds)i.Ea.has(h)&&(await i.remoteSyncer.rejectListen(h,a),i.Ea.delete(h),i.da.removeTarget(h))}(n,e)}catch(r){F(gn,"Failed to remove targets %s: %s ",e.targetIds.join(","),r),await Wi(n,r)}else if(e instanceof bi?n.da.Xe(e):e instanceof eh?n.da.st(e):n.da.tt(e),!t.isEqual(H.min()))try{const r=await fh(n.localStore);t.compareTo(r)>=0&&await function(o,a){const h=o.da.Tt(a);return h.targetChanges.forEach((f,m)=>{if(f.resumeToken.approximateByteSize()>0){const p=o.Ea.get(m);p&&o.Ea.set(m,p.withResumeToken(f.resumeToken,a))}}),h.targetMismatches.forEach((f,m)=>{const p=o.Ea.get(f);if(!p)return;o.Ea.set(f,p.withResumeToken(De.EMPTY_BYTE_STRING,p.snapshotVersion)),_h(o,f);const w=new Lt(p.target,f,m,p.sequenceNumber);Zo(o,w)}),o.remoteSyncer.applyRemoteEvent(h)}(n,t)}catch(r){F(gn,"Failed to raise snapshot:",r),await Wi(n,r)}}async function Wi(n,e,t){if(!Zn(e))throw e;n.Ia.add(1),await Wr(n),n.Va.set("Offline"),t||(t=()=>fh(n.localStore)),n.asyncQueue.enqueueRetryable(async()=>{F(gn,"Retrying IndexedDB access"),await t(),n.Ia.delete(1),await hs(n)})}function Eh(n,e){return e().catch(t=>Wi(n,t,e))}async function ds(n){const e=G(n),t=Wt(e);let r=e.Ta.length>0?e.Ta[e.Ta.length-1].batchId:Fo;for(;Hy(e);)try{const i=await Ry(e.localStore,r);if(i===null){e.Ta.length===0&&t.L_();break}r=i.batchId,Gy(e,i)}catch(i){await Wi(e,i)}Th(e)&&Ih(e)}function Hy(n){return yn(n)&&n.Ta.length<10}function Gy(n,e){n.Ta.push(e);const t=Wt(n);t.O_()&&t.Y_&&t.ea(e.mutations)}function Th(n){return yn(n)&&!Wt(n).x_()&&n.Ta.length>0}function Ih(n){Wt(n).start()}async function Wy(n){Wt(n).ra()}async function Ky(n){const e=Wt(n);for(const t of n.Ta)e.ea(t.mutations)}async function Qy(n,e,t){const r=n.Ta.shift(),i=Ho.from(r,e,t);await Eh(n,()=>n.remoteSyncer.applySuccessfulWrite(i)),await ds(n)}async function Jy(n,e){e&&Wt(n).Y_&&await async function(r,i){if(function(a){return k_(a)&&a!==O.ABORTED}(i.code)){const o=r.Ta.shift();Wt(r).B_(),await Eh(r,()=>r.remoteSyncer.rejectFailedWrite(o.batchId,i)),await ds(r)}}(n,e),Th(n)&&Ih(n)}async function ou(n,e){const t=G(n);t.asyncQueue.verifyOperationInProgress(),F(gn,"RemoteStore received new credentials");const r=yn(t);t.Ia.add(3),await Wr(t),r&&t.Va.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.Ia.delete(3),await hs(t)}async function Yy(n,e){const t=G(n);e?(t.Ia.delete(2),await hs(t)):e||(t.Ia.add(2),await Wr(t),t.Va.set("Unknown"))}function er(n){return n.ma||(n.ma=function(t,r,i){const o=G(t);return o.sa(),new xy(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)}(n.datastore,n.asyncQueue,{Zo:jy.bind(null,n),Yo:$y.bind(null,n),t_:qy.bind(null,n),H_:zy.bind(null,n)}),n.Ra.push(async e=>{e?(n.ma.B_(),ta(n)?ea(n):n.Va.set("Unknown")):(await n.ma.stop(),yh(n))})),n.ma}function Wt(n){return n.fa||(n.fa=function(t,r,i){const o=G(t);return o.sa(),new Oy(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)}(n.datastore,n.asyncQueue,{Zo:()=>Promise.resolve(),Yo:Wy.bind(null,n),t_:Jy.bind(null,n),ta:Ky.bind(null,n),na:Qy.bind(null,n)}),n.Ra.push(async e=>{e?(n.fa.B_(),await ds(n)):(await n.fa.stop(),n.Ta.length>0&&(F(gn,`Stopping write stream with ${n.Ta.length} pending writes`),n.Ta=[]))})),n.fa}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class na{constructor(e,t,r,i,o){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=r,this.op=i,this.removalCallback=o,this.deferred=new $t,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch(a=>{})}get promise(){return this.deferred.promise}static createAndSchedule(e,t,r,i,o){const a=Date.now()+r,h=new na(e,t,a,i,o);return h.start(r),h}start(e){this.timerHandle=setTimeout(()=>this.handleDelayElapsed(),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new B(O.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget(()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then(e=>this.deferred.resolve(e))):Promise.resolve())}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function ra(n,e){if(It("AsyncQueue",`${e}: ${n}`),Zn(n))return new B(O.UNAVAILABLE,`${e}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jn{static emptySet(e){return new jn(e.comparator)}constructor(e){this.comparator=e?(t,r)=>e(t,r)||$.comparator(t.key,r.key):(t,r)=>$.comparator(t.key,r.key),this.keyedMap=yr(),this.sortedSet=new de(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal((t,r)=>(e(t),!1))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof jn)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),r=e.sortedSet.getIterator();for(;t.hasNext();){const i=t.getNext().key,o=r.getNext().key;if(!i.isEqual(o))return!1}return!0}toString(){const e=[];return this.forEach(t=>{e.push(t.toString())}),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const r=new jn;return r.comparator=this.comparator,r.keyedMap=e,r.sortedSet=t,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class au{constructor(){this.ga=new de($.comparator)}track(e){const t=e.doc.key,r=this.ga.get(t);r?e.type!==0&&r.type===3?this.ga=this.ga.insert(t,e):e.type===3&&r.type!==1?this.ga=this.ga.insert(t,{type:r.type,doc:e.doc}):e.type===2&&r.type===2?this.ga=this.ga.insert(t,{type:2,doc:e.doc}):e.type===2&&r.type===0?this.ga=this.ga.insert(t,{type:0,doc:e.doc}):e.type===1&&r.type===0?this.ga=this.ga.remove(t):e.type===1&&r.type===2?this.ga=this.ga.insert(t,{type:1,doc:r.doc}):e.type===0&&r.type===1?this.ga=this.ga.insert(t,{type:2,doc:e.doc}):q(63341,{Vt:e,pa:r}):this.ga=this.ga.insert(t,e)}ya(){const e=[];return this.ga.inorderTraversal((t,r)=>{e.push(r)}),e}}class Kn{constructor(e,t,r,i,o,a,h,f,m){this.query=e,this.docs=t,this.oldDocs=r,this.docChanges=i,this.mutatedKeys=o,this.fromCache=a,this.syncStateChanged=h,this.excludesMetadataChanges=f,this.hasCachedResults=m}static fromInitialDocuments(e,t,r,i,o){const a=[];return t.forEach(h=>{a.push({type:0,doc:h})}),new Kn(e,t,jn.emptySet(t),a,r,i,!0,!1,o)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&ss(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,r=e.docChanges;if(t.length!==r.length)return!1;for(let i=0;i<t.length;i++)if(t[i].type!==r[i].type||!t[i].doc.isEqual(r[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xy{constructor(){this.wa=void 0,this.Sa=[]}ba(){return this.Sa.some(e=>e.Da())}}class Zy{constructor(){this.queries=cu(),this.onlineState="Unknown",this.Ca=new Set}terminate(){(function(t,r){const i=G(t),o=i.queries;i.queries=cu(),o.forEach((a,h)=>{for(const f of h.Sa)f.onError(r)})})(this,new B(O.ABORTED,"Firestore shutting down"))}}function cu(){return new _n(n=>Bl(n),ss)}async function eE(n,e){const t=G(n);let r=3;const i=e.query;let o=t.queries.get(i);o?!o.ba()&&e.Da()&&(r=2):(o=new Xy,r=e.Da()?0:1);try{switch(r){case 0:o.wa=await t.onListen(i,!0);break;case 1:o.wa=await t.onListen(i,!1);break;case 2:await t.onFirstRemoteStoreListen(i)}}catch(a){const h=ra(a,`Initialization of query '${Nn(e.query)}' failed`);return void e.onError(h)}t.queries.set(i,o),o.Sa.push(e),e.va(t.onlineState),o.wa&&e.Fa(o.wa)&&ia(t)}async function tE(n,e){const t=G(n),r=e.query;let i=3;const o=t.queries.get(r);if(o){const a=o.Sa.indexOf(e);a>=0&&(o.Sa.splice(a,1),o.Sa.length===0?i=e.Da()?0:1:!o.ba()&&e.Da()&&(i=2))}switch(i){case 0:return t.queries.delete(r),t.onUnlisten(r,!0);case 1:return t.queries.delete(r),t.onUnlisten(r,!1);case 2:return t.onLastRemoteStoreUnlisten(r);default:return}}function nE(n,e){const t=G(n);let r=!1;for(const i of e){const o=i.query,a=t.queries.get(o);if(a){for(const h of a.Sa)h.Fa(i)&&(r=!0);a.wa=i}}r&&ia(t)}function rE(n,e,t){const r=G(n),i=r.queries.get(e);if(i)for(const o of i.Sa)o.onError(t);r.queries.delete(e)}function ia(n){n.Ca.forEach(e=>{e.next()})}var yo,uu;(uu=yo||(yo={})).Ma="default",uu.Cache="cache";class iE{constructor(e,t,r){this.query=e,this.xa=t,this.Oa=!1,this.Na=null,this.onlineState="Unknown",this.options=r||{}}Fa(e){if(!this.options.includeMetadataChanges){const r=[];for(const i of e.docChanges)i.type!==3&&r.push(i);e=new Kn(e.query,e.docs,e.oldDocs,r,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.Oa?this.Ba(e)&&(this.xa.next(e),t=!0):this.La(e,this.onlineState)&&(this.ka(e),t=!0),this.Na=e,t}onError(e){this.xa.error(e)}va(e){this.onlineState=e;let t=!1;return this.Na&&!this.Oa&&this.La(this.Na,e)&&(this.ka(this.Na),t=!0),t}La(e,t){if(!e.fromCache||!this.Da())return!0;const r=t!=="Offline";return(!this.options.qa||!r)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}Ba(e){if(e.docChanges.length>0)return!0;const t=this.Na&&this.Na.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}ka(e){e=Kn.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.Oa=!0,this.xa.next(e)}Da(){return this.options.source!==yo.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class wh{constructor(e){this.key=e}}class vh{constructor(e){this.key=e}}class sE{constructor(e,t){this.query=e,this.Za=t,this.Xa=null,this.hasCachedResults=!1,this.current=!1,this.Ya=Y(),this.mutatedKeys=Y(),this.eu=jl(e),this.tu=new jn(this.eu)}get nu(){return this.Za}ru(e,t){const r=t?t.iu:new au,i=t?t.tu:this.tu;let o=t?t.mutatedKeys:this.mutatedKeys,a=i,h=!1;const f=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,m=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(e.inorderTraversal((p,w)=>{const k=i.get(p),N=os(this.query,w)?w:null,L=!!k&&this.mutatedKeys.has(k.key),j=!!N&&(N.hasLocalMutations||this.mutatedKeys.has(N.key)&&N.hasCommittedMutations);let U=!1;k&&N?k.data.isEqual(N.data)?L!==j&&(r.track({type:3,doc:N}),U=!0):this.su(k,N)||(r.track({type:2,doc:N}),U=!0,(f&&this.eu(N,f)>0||m&&this.eu(N,m)<0)&&(h=!0)):!k&&N?(r.track({type:0,doc:N}),U=!0):k&&!N&&(r.track({type:1,doc:k}),U=!0,(f||m)&&(h=!0)),U&&(N?(a=a.add(N),o=j?o.add(p):o.delete(p)):(a=a.delete(p),o=o.delete(p)))}),this.query.limit!==null)for(;a.size>this.query.limit;){const p=this.query.limitType==="F"?a.last():a.first();a=a.delete(p.key),o=o.delete(p.key),r.track({type:1,doc:p})}return{tu:a,iu:r,bs:h,mutatedKeys:o}}su(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,r,i){const o=this.tu;this.tu=e.tu,this.mutatedKeys=e.mutatedKeys;const a=e.iu.ya();a.sort((p,w)=>function(N,L){const j=U=>{switch(U){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return q(20277,{Vt:U})}};return j(N)-j(L)}(p.type,w.type)||this.eu(p.doc,w.doc)),this.ou(r),i=i??!1;const h=t&&!i?this._u():[],f=this.Ya.size===0&&this.current&&!i?1:0,m=f!==this.Xa;return this.Xa=f,a.length!==0||m?{snapshot:new Kn(this.query,e.tu,o,a,e.mutatedKeys,f===0,m,!1,!!r&&r.resumeToken.approximateByteSize()>0),au:h}:{au:h}}va(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({tu:this.tu,iu:new au,mutatedKeys:this.mutatedKeys,bs:!1},!1)):{au:[]}}uu(e){return!this.Za.has(e)&&!!this.tu.has(e)&&!this.tu.get(e).hasLocalMutations}ou(e){e&&(e.addedDocuments.forEach(t=>this.Za=this.Za.add(t)),e.modifiedDocuments.forEach(t=>{}),e.removedDocuments.forEach(t=>this.Za=this.Za.delete(t)),this.current=e.current)}_u(){if(!this.current)return[];const e=this.Ya;this.Ya=Y(),this.tu.forEach(r=>{this.uu(r.key)&&(this.Ya=this.Ya.add(r.key))});const t=[];return e.forEach(r=>{this.Ya.has(r)||t.push(new vh(r))}),this.Ya.forEach(r=>{e.has(r)||t.push(new wh(r))}),t}cu(e){this.Za=e.ks,this.Ya=Y();const t=this.ru(e.documents);return this.applyChanges(t,!0)}lu(){return Kn.fromInitialDocuments(this.query,this.tu,this.mutatedKeys,this.Xa===0,this.hasCachedResults)}}const sa="SyncEngine";class oE{constructor(e,t,r){this.query=e,this.targetId=t,this.view=r}}class aE{constructor(e){this.key=e,this.hu=!1}}class cE{constructor(e,t,r,i,o,a){this.localStore=e,this.remoteStore=t,this.eventManager=r,this.sharedClientState=i,this.currentUser=o,this.maxConcurrentLimboResolutions=a,this.Pu={},this.Tu=new _n(h=>Bl(h),ss),this.Eu=new Map,this.Iu=new Set,this.Ru=new de($.comparator),this.Au=new Map,this.Vu=new Ko,this.du={},this.mu=new Map,this.fu=Wn.ar(),this.onlineState="Unknown",this.gu=void 0}get isPrimaryClient(){return this.gu===!0}}async function uE(n,e,t=!0){const r=bh(n);let i;const o=r.Tu.get(e);return o?(r.sharedClientState.addLocalQueryTarget(o.targetId),i=o.view.lu()):i=await Ah(r,e,t,!0),i}async function lE(n,e){const t=bh(n);await Ah(t,e,!0,!1)}async function Ah(n,e,t,r){const i=await Sy(n.localStore,at(e)),o=i.targetId,a=n.sharedClientState.addLocalQueryTarget(o,t);let h;return r&&(h=await hE(n,e,o,a==="current",i.resumeToken)),n.isPrimaryClient&&t&&gh(n.remoteStore,i),h}async function hE(n,e,t,r,i){n.pu=(w,k,N)=>async function(j,U,ee,Z){let ue=U.view.ru(ee);ue.bs&&(ue=await tu(j.localStore,U.query,!1).then(({documents:R})=>U.view.ru(R,ue)));const Ne=Z&&Z.targetChanges.get(U.targetId),Re=Z&&Z.targetMismatches.get(U.targetId)!=null,ye=U.view.applyChanges(ue,j.isPrimaryClient,Ne,Re);return hu(j,U.targetId,ye.au),ye.snapshot}(n,w,k,N);const o=await tu(n.localStore,e,!0),a=new sE(e,o.ks),h=a.ru(o.documents),f=Gr.createSynthesizedTargetChangeForCurrentChange(t,r&&n.onlineState!=="Offline",i),m=a.applyChanges(h,n.isPrimaryClient,f);hu(n,t,m.au);const p=new oE(e,t,a);return n.Tu.set(e,p),n.Eu.has(t)?n.Eu.get(t).push(e):n.Eu.set(t,[e]),m.snapshot}async function dE(n,e,t){const r=G(n),i=r.Tu.get(e),o=r.Eu.get(i.targetId);if(o.length>1)return r.Eu.set(i.targetId,o.filter(a=>!ss(a,e))),void r.Tu.delete(e);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(i.targetId),r.sharedClientState.isActiveQueryTarget(i.targetId)||await go(r.localStore,i.targetId,!1).then(()=>{r.sharedClientState.clearQueryState(i.targetId),t&&Xo(r.remoteStore,i.targetId),Eo(r,i.targetId)}).catch(Xn)):(Eo(r,i.targetId),await go(r.localStore,i.targetId,!0))}async function fE(n,e){const t=G(n),r=t.Tu.get(e),i=t.Eu.get(r.targetId);t.isPrimaryClient&&i.length===1&&(t.sharedClientState.removeLocalQueryTarget(r.targetId),Xo(t.remoteStore,r.targetId))}async function pE(n,e,t){const r=IE(n);try{const i=await function(a,h){const f=G(a),m=ce.now(),p=h.reduce((N,L)=>N.add(L.key),Y());let w,k;return f.persistence.runTransaction("Locally write mutations","readwrite",N=>{let L=wt(),j=Y();return f.xs.getEntries(N,p).next(U=>{L=U,L.forEach((ee,Z)=>{Z.isValidDocument()||(j=j.add(ee))})}).next(()=>f.localDocuments.getOverlayedDocuments(N,L)).next(U=>{w=U;const ee=[];for(const Z of h){const ue=R_(Z,w.get(Z.key).overlayedDocument);ue!=null&&ee.push(new Jt(Z.key,ue,Nl(ue.value.mapValue),ct.exists(!0)))}return f.mutationQueue.addMutationBatch(N,m,ee,h)}).next(U=>{k=U;const ee=U.applyToLocalDocumentSet(w,j);return f.documentOverlayCache.saveOverlays(N,U.batchId,ee)})}).then(()=>({batchId:k.batchId,changes:ql(w)}))}(r.localStore,e);r.sharedClientState.addPendingMutation(i.batchId),function(a,h,f){let m=a.du[a.currentUser.toKey()];m||(m=new de(J)),m=m.insert(h,f),a.du[a.currentUser.toKey()]=m}(r,i.batchId,t),await Kr(r,i.changes),await ds(r.remoteStore)}catch(i){const o=ra(i,"Failed to persist write");t.reject(o)}}async function Rh(n,e){const t=G(n);try{const r=await vy(t.localStore,e);e.targetChanges.forEach((i,o)=>{const a=t.Au.get(o);a&&(ne(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1,22616),i.addedDocuments.size>0?a.hu=!0:i.modifiedDocuments.size>0?ne(a.hu,14607):i.removedDocuments.size>0&&(ne(a.hu,42227),a.hu=!1))}),await Kr(t,r,e)}catch(r){await Xn(r)}}function lu(n,e,t){const r=G(n);if(r.isPrimaryClient&&t===0||!r.isPrimaryClient&&t===1){const i=[];r.Tu.forEach((o,a)=>{const h=a.view.va(e);h.snapshot&&i.push(h.snapshot)}),function(a,h){const f=G(a);f.onlineState=h;let m=!1;f.queries.forEach((p,w)=>{for(const k of w.Sa)k.va(h)&&(m=!0)}),m&&ia(f)}(r.eventManager,e),i.length&&r.Pu.H_(i),r.onlineState=e,r.isPrimaryClient&&r.sharedClientState.setOnlineState(e)}}async function mE(n,e,t){const r=G(n);r.sharedClientState.updateQueryState(e,"rejected",t);const i=r.Au.get(e),o=i&&i.key;if(o){let a=new de($.comparator);a=a.insert(o,Fe.newNoDocument(o,H.min()));const h=Y().add(o),f=new us(H.min(),new Map,new de(J),a,h);await Rh(r,f),r.Ru=r.Ru.remove(o),r.Au.delete(e),oa(r)}else await go(r.localStore,e,!1).then(()=>Eo(r,e,t)).catch(Xn)}async function gE(n,e){const t=G(n),r=e.batch.batchId;try{const i=await wy(t.localStore,e);Ph(t,r,null),Sh(t,r),t.sharedClientState.updateMutationState(r,"acknowledged"),await Kr(t,i)}catch(i){await Xn(i)}}async function _E(n,e,t){const r=G(n);try{const i=await function(a,h){const f=G(a);return f.persistence.runTransaction("Reject batch","readwrite-primary",m=>{let p;return f.mutationQueue.lookupMutationBatch(m,h).next(w=>(ne(w!==null,37113),p=w.keys(),f.mutationQueue.removeMutationBatch(m,w))).next(()=>f.mutationQueue.performConsistencyCheck(m)).next(()=>f.documentOverlayCache.removeOverlaysForBatchId(m,p,h)).next(()=>f.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(m,p)).next(()=>f.localDocuments.getDocuments(m,p))})}(r.localStore,e);Ph(r,e,t),Sh(r,e),r.sharedClientState.updateMutationState(e,"rejected",t),await Kr(r,i)}catch(i){await Xn(i)}}function Sh(n,e){(n.mu.get(e)||[]).forEach(t=>{t.resolve()}),n.mu.delete(e)}function Ph(n,e,t){const r=G(n);let i=r.du[r.currentUser.toKey()];if(i){const o=i.get(e);o&&(t?o.reject(t):o.resolve(),i=i.remove(e)),r.du[r.currentUser.toKey()]=i}}function Eo(n,e,t=null){n.sharedClientState.removeLocalQueryTarget(e);for(const r of n.Eu.get(e))n.Tu.delete(r),t&&n.Pu.yu(r,t);n.Eu.delete(e),n.isPrimaryClient&&n.Vu.Gr(e).forEach(r=>{n.Vu.containsKey(r)||Ch(n,r)})}function Ch(n,e){n.Iu.delete(e.path.canonicalString());const t=n.Ru.get(e);t!==null&&(Xo(n.remoteStore,t),n.Ru=n.Ru.remove(e),n.Au.delete(t),oa(n))}function hu(n,e,t){for(const r of t)r instanceof wh?(n.Vu.addReference(r.key,e),yE(n,r)):r instanceof vh?(F(sa,"Document no longer in limbo: "+r.key),n.Vu.removeReference(r.key,e),n.Vu.containsKey(r.key)||Ch(n,r.key)):q(19791,{wu:r})}function yE(n,e){const t=e.key,r=t.path.canonicalString();n.Ru.get(t)||n.Iu.has(r)||(F(sa,"New document in limbo: "+t),n.Iu.add(r),oa(n))}function oa(n){for(;n.Iu.size>0&&n.Ru.size<n.maxConcurrentLimboResolutions;){const e=n.Iu.values().next().value;n.Iu.delete(e);const t=new $(he.fromString(e)),r=n.fu.next();n.Au.set(r,new aE(t)),n.Ru=n.Ru.insert(t,r),gh(n.remoteStore,new Lt(at(qo(t.path)),r,"TargetPurposeLimboResolution",ts.ce))}}async function Kr(n,e,t){const r=G(n),i=[],o=[],a=[];r.Tu.isEmpty()||(r.Tu.forEach((h,f)=>{a.push(r.pu(f,e,t).then(m=>{var p;if((m||t)&&r.isPrimaryClient){const w=m?!m.fromCache:(p=t==null?void 0:t.targetChanges.get(f.targetId))==null?void 0:p.current;r.sharedClientState.updateQueryState(f.targetId,w?"current":"not-current")}if(m){i.push(m);const w=Jo.Is(f.targetId,m);o.push(w)}}))}),await Promise.all(a),r.Pu.H_(i),await async function(f,m){const p=G(f);try{await p.persistence.runTransaction("notifyLocalViewChanges","readwrite",w=>x.forEach(m,k=>x.forEach(k.Ts,N=>p.persistence.referenceDelegate.addReference(w,k.targetId,N)).next(()=>x.forEach(k.Es,N=>p.persistence.referenceDelegate.removeReference(w,k.targetId,N)))))}catch(w){if(!Zn(w))throw w;F(Yo,"Failed to update sequence numbers: "+w)}for(const w of m){const k=w.targetId;if(!w.fromCache){const N=p.vs.get(k),L=N.snapshotVersion,j=N.withLastLimboFreeSnapshotVersion(L);p.vs=p.vs.insert(k,j)}}}(r.localStore,o))}async function EE(n,e){const t=G(n);if(!t.currentUser.isEqual(e)){F(sa,"User change. New user:",e.toKey());const r=await dh(t.localStore,e);t.currentUser=e,function(o,a){o.mu.forEach(h=>{h.forEach(f=>{f.reject(new B(O.CANCELLED,a))})}),o.mu.clear()}(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,r.removedBatchIds,r.addedBatchIds),await Kr(t,r.Ns)}}function TE(n,e){const t=G(n),r=t.Au.get(e);if(r&&r.hu)return Y().add(r.key);{let i=Y();const o=t.Eu.get(e);if(!o)return i;for(const a of o){const h=t.Tu.get(a);i=i.unionWith(h.view.nu)}return i}}function bh(n){const e=G(n);return e.remoteStore.remoteSyncer.applyRemoteEvent=Rh.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=TE.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=mE.bind(null,e),e.Pu.H_=nE.bind(null,e.eventManager),e.Pu.yu=rE.bind(null,e.eventManager),e}function IE(n){const e=G(n);return e.remoteStore.remoteSyncer.applySuccessfulWrite=gE.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=_E.bind(null,e),e}class Ki{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=ls(e.databaseInfo.databaseId),this.sharedClientState=this.Du(e),this.persistence=this.Cu(e),await this.persistence.start(),this.localStore=this.vu(e),this.gcScheduler=this.Fu(e,this.localStore),this.indexBackfillerScheduler=this.Mu(e,this.localStore)}Fu(e,t){return null}Mu(e,t){return null}vu(e){return Iy(this.persistence,new yy,e.initialUser,this.serializer)}Cu(e){return new hh(Qo.Vi,this.serializer)}Du(e){return new Cy}async terminate(){var e,t;(e=this.gcScheduler)==null||e.stop(),(t=this.indexBackfillerScheduler)==null||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}Ki.provider={build:()=>new Ki};class wE extends Ki{constructor(e){super(),this.cacheSizeBytes=e}Fu(e,t){ne(this.persistence.referenceDelegate instanceof Gi,46915);const r=this.persistence.referenceDelegate.garbageCollector;return new ry(r,e.asyncQueue,t)}Cu(e){const t=this.cacheSizeBytes!==void 0?$e.withCacheSize(this.cacheSizeBytes):$e.DEFAULT;return new hh(r=>Gi.Vi(r,t),this.serializer)}}class To{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>lu(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=EE.bind(null,this.syncEngine),await Yy(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return function(){return new Zy}()}createDatastore(e){const t=ls(e.databaseInfo.databaseId),r=Ny(e.databaseInfo);return Fy(e.authCredentials,e.appCheckCredentials,r,t)}createRemoteStore(e){return function(r,i,o,a,h){return new By(r,i,o,a,h)}(this.localStore,this.datastore,e.asyncQueue,t=>lu(this.syncEngine,t,0),function(){return iu.v()?new iu:new by}())}createSyncEngine(e,t){return function(i,o,a,h,f,m,p){const w=new cE(i,o,a,h,f,m);return p&&(w.gu=!0),w}(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e,t;await async function(i){const o=G(i);F(gn,"RemoteStore shutting down."),o.Ia.add(5),await Wr(o),o.Aa.shutdown(),o.Va.set("Unknown")}(this.remoteStore),(e=this.datastore)==null||e.terminate(),(t=this.eventManager)==null||t.terminate()}}To.provider={build:()=>new To};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vE{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Ou(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Ou(this.observer.error,e):It("Uncaught Error in snapshot listener:",e.toString()))}Nu(){this.muted=!0}Ou(e,t){setTimeout(()=>{this.muted||e(t)},0)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Kt="FirestoreClient";class AE{constructor(e,t,r,i,o){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=r,this._databaseInfo=i,this.user=Le.UNAUTHENTICATED,this.clientId=Mo.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=o,this.authCredentials.start(r,async a=>{F(Kt,"Received user=",a.uid),await this.authCredentialListener(a),this.user=a}),this.appCheckCredentials.start(r,a=>(F(Kt,"Received new app check token=",a),this.appCheckCredentialListener(a,this.user)))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this._databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new $t;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted(async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const r=ra(t,"Failed to shutdown persistence");e.reject(r)}}),e.promise}}async function Ws(n,e){n.asyncQueue.verifyOperationInProgress(),F(Kt,"Initializing OfflineComponentProvider");const t=n.configuration;await e.initialize(t);let r=t.initialUser;n.setCredentialChangeListener(async i=>{r.isEqual(i)||(await dh(e.localStore,i),r=i)}),e.persistence.setDatabaseDeletedListener(()=>n.terminate()),n._offlineComponents=e}async function du(n,e){n.asyncQueue.verifyOperationInProgress();const t=await RE(n);F(Kt,"Initializing OnlineComponentProvider"),await e.initialize(t,n.configuration),n.setCredentialChangeListener(r=>ou(e.remoteStore,r)),n.setAppCheckTokenChangeListener((r,i)=>ou(e.remoteStore,i)),n._onlineComponents=e}async function RE(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){F(Kt,"Using user provided OfflineComponentProvider");try{await Ws(n,n._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!function(i){return i.name==="FirebaseError"?i.code===O.FAILED_PRECONDITION||i.code===O.UNIMPLEMENTED:!(typeof DOMException<"u"&&i instanceof DOMException)||i.code===22||i.code===20||i.code===11}(t))throw t;pn("Error using user provided cache. Falling back to memory cache: "+t),await Ws(n,new Ki)}}else F(Kt,"Using default OfflineComponentProvider"),await Ws(n,new wE(void 0));return n._offlineComponents}async function kh(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(F(Kt,"Using user provided OnlineComponentProvider"),await du(n,n._uninitializedComponentsProvider._online)):(F(Kt,"Using default OnlineComponentProvider"),await du(n,new To))),n._onlineComponents}function SE(n){return kh(n).then(e=>e.syncEngine)}async function PE(n){const e=await kh(n),t=e.eventManager;return t.onListen=uE.bind(null,e.syncEngine),t.onUnlisten=dE.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=lE.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=fE.bind(null,e.syncEngine),t}function CE(n,e,t={}){const r=new $t;return n.asyncQueue.enqueueAndForget(async()=>function(o,a,h,f,m){const p=new vE({next:k=>{p.Nu(),a.enqueueAndForget(()=>tE(o,w));const N=k.docs.has(h);!N&&k.fromCache?m.reject(new B(O.UNAVAILABLE,"Failed to get document because the client is offline.")):N&&k.fromCache&&f&&f.source==="server"?m.reject(new B(O.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):m.resolve(k)},error:k=>m.reject(k)}),w=new iE(qo(h.path),p,{includeMetadataChanges:!0,qa:!0});return eE(o,w)}(await PE(n),n.asyncQueue,e,t,r)),r.promise}function bE(n,e){const t=new $t;return n.asyncQueue.enqueueAndForget(async()=>pE(await SE(n),e,t)),t.promise}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Vh(n){const e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kE="ComponentProvider",fu=new Map;function VE(n,e,t,r,i){return new Gg(n,e,t,i.host,i.ssl,i.experimentalForceLongPolling,i.experimentalAutoDetectLongPolling,Vh(i.experimentalLongPollingOptions),i.useFetchStreams,i.isUsingEmulator,r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Dh="firestore.googleapis.com",pu=!0;class mu{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new B(O.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=Dh,this.ssl=pu}else this.host=e.host,this.ssl=e.ssl??pu;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=lh;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<ty)throw new B(O.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}Og("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Vh(e.experimentalLongPollingOptions??{}),function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new B(O.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new B(O.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new B(O.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}}(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&function(r,i){return r.timeoutSeconds===i.timeoutSeconds}(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class aa{constructor(e,t,r,i){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new mu({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new B(O.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new B(O.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new mu(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=function(r){if(!r)return new Ag;switch(r.type){case"firstParty":return new Cg(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new B(O.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}}(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return function(t){const r=fu.get(t);r&&(F(kE,"Removing Datastore"),fu.delete(t),r.terminate())}(this),Promise.resolve()}}function DE(n,e,t,r={}){var m;n=mn(n,aa);const i=Br(e),o=n._getSettings(),a={...o,emulatorOptions:n._getEmulatorOptions()},h=`${e}:${t}`;i&&Vu(`https://${h}`),o.host!==Dh&&o.host!==h&&pn("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const f={...o,host:h,ssl:i,emulatorOptions:r};if(!ln(f,a)&&(n._setSettings(f),r.mockUserToken)){let p,w;if(typeof r.mockUserToken=="string")p=r.mockUserToken,w=Le.MOCK_USER;else{p=Sd(r.mockUserToken,(m=n._app)==null?void 0:m.options.projectId);const k=r.mockUserToken.sub||r.mockUserToken.user_id;if(!k)throw new B(O.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");w=new Le(k)}n._authCredentials=new Rg(new wl(p,w))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ca{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new ca(this.firestore,e,this._query)}}class we{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new Mr(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new we(this.firestore,e,this._key)}toJSON(){return{type:we._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,r){if(zr(t,we._jsonSchema))return new we(e,r||null,new $(he.fromString(t.referencePath)))}}we._jsonSchemaVersion="firestore/documentReference/1.0",we._jsonSchema={type:_e("string",we._jsonSchemaVersion),referencePath:_e("string")};class Mr extends ca{constructor(e,t,r){super(e,t,qo(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new we(this.firestore,null,new $(e))}withConverter(e){return new Mr(this.firestore,e,this._path)}}function eT(n,e,...t){if(n=je(n),arguments.length===1&&(e=Mo.newId()),xg("doc","path",e),n instanceof aa){const r=he.fromString(e,...t);return bc(r),new we(n,null,new $(r))}{if(!(n instanceof we||n instanceof Mr))throw new B(O.INVALID_ARGUMENT,"Expected first argument to doc() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(he.fromString(e,...t));return bc(r),new we(n.firestore,n instanceof Mr?n.converter:null,new $(r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gu="AsyncQueue";class _u{constructor(e=Promise.resolve()){this.Yu=[],this.ec=!1,this.tc=[],this.nc=null,this.rc=!1,this.sc=!1,this.oc=[],this.M_=new ph(this,"async_queue_retry"),this._c=()=>{const r=Gs();r&&F(gu,"Visibility state changed to "+r.visibilityState),this.M_.w_()},this.ac=e;const t=Gs();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this._c)}get isShuttingDown(){return this.ec}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.uc(),this.cc(e)}enterRestrictedMode(e){if(!this.ec){this.ec=!0,this.sc=e||!1;const t=Gs();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this._c)}}enqueue(e){if(this.uc(),this.ec)return new Promise(()=>{});const t=new $t;return this.cc(()=>this.ec&&this.sc?Promise.resolve():(e().then(t.resolve,t.reject),t.promise)).then(()=>t.promise)}enqueueRetryable(e){this.enqueueAndForget(()=>(this.Yu.push(e),this.lc()))}async lc(){if(this.Yu.length!==0){try{await this.Yu[0](),this.Yu.shift(),this.M_.reset()}catch(e){if(!Zn(e))throw e;F(gu,"Operation failed with retryable error: "+e)}this.Yu.length>0&&this.M_.p_(()=>this.lc())}}cc(e){const t=this.ac.then(()=>(this.rc=!0,e().catch(r=>{throw this.nc=r,this.rc=!1,It("INTERNAL UNHANDLED ERROR: ",yu(r)),r}).then(r=>(this.rc=!1,r))));return this.ac=t,t}enqueueAfterDelay(e,t,r){this.uc(),this.oc.indexOf(e)>-1&&(t=0);const i=na.createAndSchedule(this,e,t,r,o=>this.hc(o));return this.tc.push(i),i}uc(){this.nc&&q(47125,{Pc:yu(this.nc)})}verifyOperationInProgress(){}async Tc(){let e;do e=this.ac,await e;while(e!==this.ac)}Ec(e){for(const t of this.tc)if(t.timerId===e)return!0;return!1}Ic(e){return this.Tc().then(()=>{this.tc.sort((t,r)=>t.targetTimeMs-r.targetTimeMs);for(const t of this.tc)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.Tc()})}Rc(e){this.oc.push(e)}hc(e){const t=this.tc.indexOf(e);this.tc.splice(t,1)}}function yu(n){let e=n.message||"";return n.stack&&(e=n.stack.includes(n.message)?n.stack:n.message+`
`+n.stack),e}class fs extends aa{constructor(e,t,r,i){super(e,t,r,i),this.type="firestore",this._queue=new _u,this._persistenceKey=(i==null?void 0:i.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new _u(e),this._firestoreClient=void 0,await e}}}function tT(n,e){const t=typeof n=="object"?n:xu(),r=typeof n=="string"?n:e||Bi,i=vo(t,"firestore").getImmediate({identifier:r});if(!i._initialized){const o=Ad("firestore");o&&DE(i,...o)}return i}function Nh(n){if(n._terminated)throw new B(O.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||NE(n),n._firestoreClient}function NE(n){var r,i,o,a;const e=n._freezeSettings(),t=VE(n._databaseId,((r=n._app)==null?void 0:r.options.appId)||"",n._persistenceKey,(i=n._app)==null?void 0:i.options.apiKey,e);n._componentsProvider||(o=e.localCache)!=null&&o._offlineComponentProvider&&((a=e.localCache)!=null&&a._onlineComponentProvider)&&(n._componentsProvider={_offline:e.localCache._offlineComponentProvider,_online:e.localCache._onlineComponentProvider}),n._firestoreClient=new AE(n._authCredentials,n._appCheckCredentials,n._queue,t,n._componentsProvider&&function(f){const m=f==null?void 0:f._online.build();return{_offline:f==null?void 0:f._offline.build(m),_online:m}}(n._componentsProvider))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ke{constructor(e){this._byteString=e}static fromBase64String(e){try{return new Ke(De.fromBase64String(e))}catch(t){throw new B(O.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new Ke(De.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:Ke._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(zr(e,Ke._jsonSchema))return Ke.fromBase64String(e.bytes)}}Ke._jsonSchemaVersion="firestore/bytes/1.0",Ke._jsonSchema={type:_e("string",Ke._jsonSchemaVersion),bytes:_e("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ua{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new B(O.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new Ve(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ps{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lt{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new B(O.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new B(O.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return J(this._lat,e._lat)||J(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:lt._jsonSchemaVersion}}static fromJSON(e){if(zr(e,lt._jsonSchema))return new lt(e.latitude,e.longitude)}}lt._jsonSchemaVersion="firestore/geoPoint/1.0",lt._jsonSchema={type:_e("string",lt._jsonSchemaVersion),latitude:_e("number"),longitude:_e("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xe{constructor(e){this._values=(e||[]).map(t=>t)}toArray(){return this._values.map(e=>e)}isEqual(e){return function(r,i){if(r.length!==i.length)return!1;for(let o=0;o<r.length;++o)if(r[o]!==i[o])return!1;return!0}(this._values,e._values)}toJSON(){return{type:Xe._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(zr(e,Xe._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every(t=>typeof t=="number"))return new Xe(e.vectorValues);throw new B(O.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}Xe._jsonSchemaVersion="firestore/vectorValue/1.0",Xe._jsonSchema={type:_e("string",Xe._jsonSchemaVersion),vectorValues:_e("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xE=/^__.*__$/;class OE{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return this.fieldMask!==null?new Jt(e,this.data,this.fieldMask,t,this.fieldTransforms):new Hr(e,this.data,t,this.fieldTransforms)}}class xh{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return new Jt(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function Oh(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw q(40011,{dataSource:n})}}class la{constructor(e,t,r,i,o,a){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=i,o===void 0&&this.Ac(),this.fieldTransforms=o||[],this.fieldMask=a||[]}get path(){return this.settings.path}get dataSource(){return this.settings.dataSource}i(e){return new la({...this.settings,...e},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}dc(e){var i;const t=(i=this.path)==null?void 0:i.child(e),r=this.i({path:t,arrayElement:!1});return r.mc(e),r}fc(e){var i;const t=(i=this.path)==null?void 0:i.child(e),r=this.i({path:t,arrayElement:!1});return r.Ac(),r}gc(e){return this.i({path:void 0,arrayElement:!0})}yc(e){return Qi(e,this.settings.methodName,this.settings.hasConverter||!1,this.path,this.settings.targetDoc)}contains(e){return this.fieldMask.find(t=>e.isPrefixOf(t))!==void 0||this.fieldTransforms.find(t=>e.isPrefixOf(t.field))!==void 0}Ac(){if(this.path)for(let e=0;e<this.path.length;e++)this.mc(this.path.get(e))}mc(e){if(e.length===0)throw this.yc("Document fields must not be empty");if(Oh(this.dataSource)&&xE.test(e))throw this.yc('Document fields cannot begin and end with "__"')}}class ME{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||ls(e)}A(e,t,r,i=!1){return new la({dataSource:e,methodName:t,targetDoc:r,path:Ve.emptyPath(),arrayElement:!1,hasConverter:i},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function Mh(n){const e=n._freezeSettings(),t=ls(n._databaseId);return new ME(n._databaseId,!!e.ignoreUndefinedProperties,t)}function LE(n,e,t,r,i,o={}){const a=n.A(o.merge||o.mergeFields?2:0,e,t,i);da("Data must be an object, but it was:",a,r);const h=Lh(r,a);let f,m;if(o.merge)f=new He(a.fieldMask),m=a.fieldTransforms;else if(o.mergeFields){const p=[];for(const w of o.mergeFields){const k=Lr(e,w,t);if(!a.contains(k))throw new B(O.INVALID_ARGUMENT,`Field '${k}' is specified in your field mask but missing from your input data.`);Bh(p,k)||p.push(k)}f=new He(p),m=a.fieldTransforms.filter(w=>f.covers(w.field))}else f=null,m=a.fieldTransforms;return new OE(new qe(h),f,m)}class ms extends ps{_toFieldTransform(e){if(e.dataSource!==2)throw e.dataSource===1?e.yc(`${this._methodName}() can only appear at the top level of your update data`):e.yc(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof ms}}class ha extends ps{_toFieldTransform(e){return new I_(e.path,new Nr)}isEqual(e){return e instanceof ha}}function FE(n,e,t,r){const i=n.A(1,e,t);da("Data must be an object, but it was:",i,r);const o=[],a=qe.empty();Qt(r,(f,m)=>{const p=Uh(e,f,t);m=je(m);const w=i.fc(p);if(m instanceof ms)o.push(p);else{const k=gs(m,w);k!=null&&(o.push(p),a.set(p,k))}});const h=new He(o);return new xh(a,h,i.fieldTransforms)}function UE(n,e,t,r,i,o){const a=n.A(1,e,t),h=[Lr(e,r,t)],f=[i];if(o.length%2!=0)throw new B(O.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let k=0;k<o.length;k+=2)h.push(Lr(e,o[k])),f.push(o[k+1]);const m=[],p=qe.empty();for(let k=h.length-1;k>=0;--k)if(!Bh(m,h[k])){const N=h[k];let L=f[k];L=je(L);const j=a.fc(N);if(L instanceof ms)m.push(N);else{const U=gs(L,j);U!=null&&(m.push(N),p.set(N,U))}}const w=new He(m);return new xh(p,w,a.fieldTransforms)}function gs(n,e){if(Fh(n=je(n)))return da("Unsupported field value:",e,n),Lh(n,e);if(n instanceof ps)return function(r,i){if(!Oh(i.dataSource))throw i.yc(`${r._methodName}() can only be used with update() and set()`);if(!i.path)throw i.yc(`${r._methodName}() is not currently supported inside arrays`);const o=r._toFieldTransform(i);o&&i.fieldTransforms.push(o)}(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings.arrayElement&&e.dataSource!==4)throw e.yc("Nested arrays are not supported");return function(r,i){const o=[];let a=0;for(const h of r){let f=gs(h,i.gc(a));f==null&&(f={nullValue:"NULL_VALUE"}),o.push(f),a++}return{arrayValue:{values:o}}}(n,e)}return function(r,i){if((r=je(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return y_(i.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const o=ce.fromDate(r);return{timestampValue:Hi(i.serializer,o)}}if(r instanceof ce){const o=new ce(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:Hi(i.serializer,o)}}if(r instanceof lt)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof Ke)return{bytesValue:nh(i.serializer,r._byteString)};if(r instanceof we){const o=i.databaseId,a=r.firestore._databaseId;if(!a.isEqual(o))throw i.yc(`Document reference is for database ${a.projectId}/${a.database} but should be for database ${o.projectId}/${o.database}`);return{referenceValue:Wo(r.firestore._databaseId||i.databaseId,r._key.path)}}if(r instanceof Xe)return function(a,h){const f=a instanceof Xe?a.toArray():a;return{mapValue:{fields:{[Vl]:{stringValue:Dl},[ji]:{arrayValue:{values:f.map(p=>{if(typeof p!="number")throw h.yc("VectorValues must only contain numeric values.");return zo(h.serializer,p)})}}}}}}(r,i);if(uh(r))return r._toProto(i.serializer);throw i.yc(`Unsupported field value: ${Lo(r)}`)}(n,e)}function Lh(n,e){const t={};return Rl(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):Qt(n,(r,i)=>{const o=gs(i,e.dc(r));o!=null&&(t[r]=o)}),{mapValue:{fields:t}}}function Fh(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof ce||n instanceof lt||n instanceof Ke||n instanceof we||n instanceof ps||n instanceof Xe||uh(n))}function da(n,e,t){if(!Fh(t)||!vl(t)){const r=Lo(t);throw r==="an object"?e.yc(n+" a custom object"):e.yc(n+" "+r)}}function Lr(n,e,t){if((e=je(e))instanceof ua)return e._internalPath;if(typeof e=="string")return Uh(n,e);throw Qi("Field path arguments must be of type string or ",n,!1,void 0,t)}const BE=new RegExp("[~\\*/\\[\\]]");function Uh(n,e,t){if(e.search(BE)>=0)throw Qi(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new ua(...e.split("."))._internalPath}catch{throw Qi(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function Qi(n,e,t,r,i){const o=r&&!r.isEmpty(),a=i!==void 0;let h=`Function ${e}() called with invalid data`;t&&(h+=" (via `toFirestore()`)"),h+=". ";let f="";return(o||a)&&(f+=" (found",o&&(f+=` in field ${r}`),a&&(f+=` in document ${i}`),f+=")"),new B(O.INVALID_ARGUMENT,h+n+f)}function Bh(n,e){return n.some(t=>t.isEqual(e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jE{convertValue(e,t="none"){switch(Gt(e)){case 0:return null;case 1:return e.booleanValue;case 2:return pe(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(Ht(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw q(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const r={};return Qt(e,(i,o)=>{r[i]=this.convertValue(o,t)}),r}convertVectorValue(e){var r,i,o;const t=(o=(i=(r=e.fields)==null?void 0:r[ji].arrayValue)==null?void 0:i.values)==null?void 0:o.map(a=>pe(a.doubleValue));return new Xe(t)}convertGeoPoint(e){return new lt(pe(e.latitude),pe(e.longitude))}convertArray(e,t){return(e.values||[]).map(r=>this.convertValue(r,t))}convertServerTimestamp(e,t){switch(t){case"previous":const r=rs(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(kr(e));default:return null}}convertTimestamp(e){const t=zt(e);return new ce(t.seconds,t.nanos)}convertDocumentKey(e,t){const r=he.fromString(e);ne(ch(r),9688,{name:e});const i=new Vr(r.get(1),r.get(3)),o=new $(r.popFirst(5));return i.isEqual(t)||It(`Document ${o} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),o}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $E extends jE{constructor(e){super(),this.firestore=e}convertBytes(e){return new Ke(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new we(this.firestore,null,t)}}function nT(){return new ha("serverTimestamp")}const Eu="@firebase/firestore",Tu="4.13.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jh{constructor(e,t,r,i,o){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=i,this._converter=o}get id(){return this._key.path.lastSegment()}get ref(){return new we(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new qE(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}_fieldsProto(){var e;return((e=this._document)==null?void 0:e.data.clone().value.mapValue.fields)??void 0}get(e){if(this._document){const t=this._document.data.field(Lr("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class qE extends jh{data(){return super.data()}}function zE(n,e,t){let r;return r=n?n.toFirestore(e):e,r}class Tr{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}class cn extends jh{constructor(e,t,r,i,o,a){super(e,t,r,i,a),this._firestore=e,this._firestoreImpl=e,this.metadata=o}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new ki(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const r=this._document.data.field(Lr("DocumentSnapshot.get",e));if(r!==null)return this._userDataWriter.convertValue(r,t.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new B(O.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e=this._document,t={};return t.type=cn._jsonSchemaVersion,t.bundle="",t.bundleSource="DocumentSnapshot",t.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?t:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),t.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),t)}}cn._jsonSchemaVersion="firestore/documentSnapshot/1.0",cn._jsonSchema={type:_e("string",cn._jsonSchemaVersion),bundleSource:_e("string","DocumentSnapshot"),bundleName:_e("string"),bundle:_e("string")};class ki extends cn{data(e={}){return super.data(e)}}class Sr{constructor(e,t,r,i){this._firestore=e,this._userDataWriter=t,this._snapshot=i,this.metadata=new Tr(i.hasPendingWrites,i.fromCache),this.query=r}get docs(){const e=[];return this.forEach(t=>e.push(t)),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach(r=>{e.call(t,new ki(this._firestore,this._userDataWriter,r.key,r,new Tr(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))})}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new B(O.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=function(i,o){if(i._snapshot.oldDocs.isEmpty()){let a=0;return i._snapshot.docChanges.map(h=>{const f=new ki(i._firestore,i._userDataWriter,h.doc.key,h.doc,new Tr(i._snapshot.mutatedKeys.has(h.doc.key),i._snapshot.fromCache),i.query.converter);return h.doc,{type:"added",doc:f,oldIndex:-1,newIndex:a++}})}{let a=i._snapshot.oldDocs;return i._snapshot.docChanges.filter(h=>o||h.type!==3).map(h=>{const f=new ki(i._firestore,i._userDataWriter,h.doc.key,h.doc,new Tr(i._snapshot.mutatedKeys.has(h.doc.key),i._snapshot.fromCache),i.query.converter);let m=-1,p=-1;return h.type!==0&&(m=a.indexOf(h.doc.key),a=a.delete(h.doc.key)),h.type!==1&&(a=a.add(h.doc),p=a.indexOf(h.doc.key)),{type:HE(h.type),doc:f,oldIndex:m,newIndex:p}})}}(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new B(O.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e={};e.type=Sr._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=Mo.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const t=[],r=[],i=[];return this.docs.forEach(o=>{o._document!==null&&(t.push(o._document),r.push(this._userDataWriter.convertObjectMap(o._document.data.value.mapValue.fields,"previous")),i.push(o.ref.path))}),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}}function HE(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return q(61501,{type:n})}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Sr._jsonSchemaVersion="firestore/querySnapshot/1.0",Sr._jsonSchema={type:_e("string",Sr._jsonSchemaVersion),bundleSource:_e("string","QuerySnapshot"),bundleName:_e("string"),bundle:_e("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rT(n){n=mn(n,we);const e=mn(n.firestore,fs),t=Nh(e);return CE(t,n._key).then(r=>GE(e,n,r))}function iT(n,e,t){n=mn(n,we);const r=mn(n.firestore,fs),i=zE(n.converter,e),o=Mh(r);return $h(r,[LE(o,"setDoc",n._key,i,n.converter!==null,t).toMutation(n._key,ct.none())])}function sT(n,e,t,...r){n=mn(n,we);const i=mn(n.firestore,fs),o=Mh(i);let a;return a=typeof(e=je(e))=="string"||e instanceof ua?UE(o,"updateDoc",n._key,e,t,r):FE(o,"updateDoc",n._key,e),$h(i,[a.toMutation(n._key,ct.exists(!0))])}function $h(n,e){const t=Nh(n);return bE(t,e)}function GE(n,e,t){const r=t.docs.get(e._key),i=new $E(n);return new cn(n,i,e._key,r,new Tr(t.hasPendingWrites,t.fromCache),e.converter)}(function(e,t=!0){vg(Qn),$n(new hn("firestore",(r,{instanceIdentifier:i,options:o})=>{const a=r.getProvider("app").getImmediate(),h=new fs(new Sg(r.getProvider("auth-internal")),new bg(a,r.getProvider("app-check-internal")),Wg(a,i),a);return o={useFetchStreams:t,...o},h._setSettings(o),h},"PUBLIC").setMultipleInstances(!0)),Bt(Eu,Tu,e),Bt(Eu,Tu,"esm2020")})();export{pl as B,xt as G,tT as a,KE as b,rT as c,eT as d,nT as e,iT as f,JE as g,un as h,$f as i,XE as j,WE as o,md as p,QE as s,sT as u};
