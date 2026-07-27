# Capacitor Plugin 구조 분석

## 개요

Capacitor는 웹 앱을 네이티브 앱으로 변환하는 크로스 플랫폼 런타임입니다. 플러그인 시스템을 통해 웹(JavaScript/TypeScript)에서 네이티브(iOS/Android) 기능을 호출할 수 있습니다.

---

## 1. Plugin 클래스 구조

### Android (Java/Kotlin)

**기본 클래스: `com.getcapacitor.Plugin`**

```java
public abstract class Plugin {
    protected PluginHandle pluginHandle;
    protected Bridge bridge;
    
    // 플러그인 초기화
    public void load() {}
    
    // Activity 런처 초기화
    public void initializeActivityLaunchers() {}
    
    // 플러그인 핸들 설정
    public void setPluginHandle(PluginHandle handle) { this.pluginHandle = handle; }
    public void setBridge(Bridge bridge) { this.bridge = bridge; }
    
    // URL 로드 가로채기
    public Boolean shouldOverrideLoad(Uri url) { return null; }
    
    // 리스너 제거
    public void removeAllListeners() {}
}
```

**어노테이션: `@CapacitorPlugin`**

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface CapacitorPlugin {
    String name() default "";           // JS에서 사용할 플러그인 이름
    String[] permissions() default {};  // 필요한 권한
    int[] requestCodes() default {};    // 요청 코드
    boolean skipPluginRegistration() default false;
}
```

**플러그인 구현 예시:**

```java
@CapacitorPlugin(name = "MyPlugin")
public class MyPlugin extends Plugin {
    
    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    public void echo(PluginCall call) {
        String value = call.getString("value");
        call.resolve(new JSObject().put("value", value));
    }
    
    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void addListener(PluginCall call) {
        String eventName = call.getString("eventName");
        call.setKeepAlive(true);  // 리스너 유지
        // 이벤트 등록 로직
    }
}
```

### iOS (Swift)

**프로토콜: `CAPBridgedPlugin`**

```swift
@protocol CAPBridgedPlugin <NSObject>
@property (nonatomic, readonly) NSString *identifier;      // 플러그인 식별자
@property (nonatomic, readonly) NSString *jsName;          // JS에서 사용할 이름
@property (nonatomic, readonly) NSArray<CAPPluginMethod *> *pluginMethods;  // 메서드 목록
@end
```

**매크로 기반 정의:**

```swift
// 플러그인 클래스 정의
@interface MyPlugin : NSObject
@end

@interface MyPlugin (CAPPluginCategory) <CAPBridgedPlugin>
@end

@implementation MyPlugin (CAPPluginCategory)

- (NSArray *)pluginMethods {
    NSMutableArray *methods = [NSMutableArray new];
    CAP_PLUGIN_METHOD(echo, CAPPluginReturnPromise)
    CAP_PLUGIN_METHOD(addListener, CAPPluginReturnCallback)
    return methods;
}

CAP_PLUGIN_CONFIG(MyPlugin, "MyPlugin")

@end
```

**메서드 구현:**

```swift
@objc func echo(_ call: CAPPluginCall) {
    let value = call.getString("value") ?? ""
    call.resolve(["value": value])
}

@objc func addListener(_ call: CAPPluginCall) {
    let eventName = call.getString("eventName") ?? ""
    call.keepAlive = true  // 리스너 유지
    // 이벤트 등록 로직
}
```

---

## 2. PluginMethod (메서드 정의 및 반환 타입)

### Android: `@PluginMethod` 어노테이션

```java
@Retention(RetentionPolicy.RUNTIME)
public @interface PluginMethod {
    String RETURN_PROMISE = "promise";    // Promise 반환 (기본값)
    String RETURN_CALLBACK = "callback";  // Callback 반환
    String RETURN_NONE = "none";          // 반환 없음 (fire-and-forget)
    
    String returnType() default RETURN_PROMISE;
}
```

### iOS: `CAPPluginMethod` 클래스

```swift
typedef NSString *CAPPluginReturnType;

#define CAPPluginReturnNone @"none"
#define CAPPluginReturnCallback @"callback"
#define CAPPluginReturnPromise @"promise"

@interface CAPPluginMethod : NSObject
@property (nonatomic, assign) SEL selector;
@property (nonatomic, strong) NSString *name;
@property (nonatomic, strong) CAPPluginReturnType *returnType;

- (instancetype)initWithName:(NSString *)name returnType:(CAPPluginReturnType *)returnType;
- (instancetype)initWithSelector:(SEL)selector returnType:(CAPPluginReturnType *)returnType;
@end
```

### 반환 타입별 동작

| 타입 | Android | iOS | JS에서 사용 |
|------|---------|-----|-------------|
| **Promise** | `call.resolve()` / `call.reject()` | `call.resolve()` / `call.reject()` | `await plugin.method()` |
| **Callback** | `call.setKeepAlive(true)` + 반복 호출 | `call.keepAlive = true` + 반복 호출 | `plugin.addListener()` |
| **None** | 즉시 반환, 결과 없음 | 즉시 반환, 결과 없음 | `plugin.method()` (fire-and-forget) |

---

## 3. React/JS 호출 방식

### 플러그인 등록 (JavaScript/TypeScript)

```typescript
// plugins/my-plugin.ts
import { registerPlugin, WebPlugin } from '@capacitor/core';

export interface MyPlugin {
    echo(options: { value: string }): Promise<{ value: string }>;
    addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => Promise<void> }>;
}

const MyPlugin = registerPlugin<MyPlugin>('MyPlugin', {
    web: () => import('./my-plugin-web').then(m => new m.MyPluginWeb())
});

export { MyPlugin };
```

### 웹 구현 (WebPlugin 상속)

```typescript
// plugins/my-plugin-web.ts
import { WebPlugin } from '@capacitor/core';

export class MyPluginWeb extends WebPlugin implements MyPlugin {
    async echo(options: { value: string }): Promise<{ value: string }> {
        return { value: options.value };
    }
    
    async addListener(eventName: string, callback: (data: any) => void) {
        // 웹에서 이벤트 리스너 구현
        return { remove: async () => {} };
    }
}
```

### React 컴포넌트에서 사용

```tsx
// components/MyComponent.tsx
import { MyPlugin } from '../plugins/my-plugin';

function MyComponent() {
    const handleEcho = async () => {
        // Promise 방식 호출
        const result = await MyPlugin.echo({ value: 'Hello Capacitor!' });
        console.log(result.value); // "Hello Capacitor!"
    };
    
    const handleListener = async () => {
        // 이벤트 리스너 등록 (Callback 방식)
        const { remove } = await MyPlugin.addListener('myEvent', (data) => {
            console.log('Event received:', data);
        });
        
        // 정리
        // await remove();
    };
    
    return (
        <div>
            <button onClick={handleEcho}>Echo</button>
            <button onClick={handleListener}>Add Listener</button>
        </div>
    );
}
```

### 내부 호출 흐름 (JS → Native)

```javascript
// core-plugin-definitions.js (Capacitor Core 내부)
const createPluginMethodWrapper = (prop) => {
    const wrapper = (...args) => {
        const p = loadPluginImplementation().then((impl) => {
            const fn = createPluginMethod(impl, prop);
            if (fn) {
                return fn(...args);
            }
            throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented`);
        });
        
        if (prop === 'addListener') {
            p.remove = async () => remove();
        }
        return p;
    };
    return wrapper;
};

// Promise 타입 메서드 생성
const createPluginMethod = (impl, prop) => {
    if (pluginHeader) {
        const methodHeader = pluginHeader.methods.find(m => m.name === prop);
        if (methodHeader) {
            if (methodHeader.rtype === 'promise') {
                return (options) => cap.nativePromise(pluginName, prop, options);
            } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop, options, callback);
            }
        }
    }
    // Web 구현이 있는 경우
    return impl?.[prop]?.bind(impl);
};
```

---

## 4. Native 반환 방식 (Native → JS)

### Android: `PluginCall` 클래스

```java
public class PluginCall {
    private final MessageHandler msgHandler;
    private final String pluginId;
    private final String callbackId;
    private final String methodName;
    private final JSObject data;
    private boolean keepAlive = false;
    
    // Promise 성공 반환
    public void resolve(JSObject data) {
        PluginResult result = new PluginResult(data);
        this.msgHandler.sendResponseMessage(this, result, null);
    }
    
    public void resolve() {
        this.msgHandler.sendResponseMessage(this, null, null);
    }
    
    // Promise 실패 반환
    public void reject(String msg, String code, Exception ex, JSObject data) {
        PluginResult errorResult = new PluginResult();
        errorResult.put("message", msg);
        errorResult.put("code", code);
        if (data != null) errorResult.put("data", data);
        this.msgHandler.sendResponseMessage(this, null, errorResult);
    }
    
    // Callback 방식 (리스너용)
    public void setKeepAlive(Boolean keepAlive) {
        this.keepAlive = keepAlive;
    }
}
```

### iOS: `CAPPluginCall` 클래스

```swift
@interface CAPPluginCall : NSObject
@property (nonatomic, copy) NSString *callbackId;
@property (nonatomic, copy) NSString *methodName;
@property (nonatomic, strong) NSDictionary *options;
@property (nonatomic, assign) BOOL keepAlive;

// Promise 성공
- (void)resolve:(nullable NSDictionary *)result;

// Promise 실패
- (void)reject:(nullable NSString *)errorMessage
       code:(nullable NSString *)errorCode
       error:(nullable NSError *)error
       result:(nullable NSDictionary *)result;

// Callback 방식 (리스너용)
@property (nonatomic, assign) BOOL keepAlive;
@end
```

### MessageHandler를 통한 JS 응답 전송

**Android (MessageHandler.java):**

```java
public void sendResponseMessage(PluginCall call, PluginResult successResult, PluginResult errorResult) {
    PluginResult data = new PluginResult();
    data.put("save", call.isKeptAlive());
    data.put("callbackId", call.getCallbackId());
    data.put("pluginId", call.getPluginId());
    data.put("methodName", call.getMethodName());
    
    if (errorResult != null) {
        data.put("success", false);
        data.put("error", errorResult);
    } else {
        data.put("success", true);
        if (successResult != null) {
            data.put("data", successResult);
        }
    }
    
    // WebView로 응답 전송
    if (bridge.getConfig().isUsingLegacyBridge()) {
        legacySendResponseMessage(data);
    } else if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) 
               && javaScriptReplyProxy != null) {
        javaScriptReplyProxy.postMessage(data.toString());  // Modern 방식
    } else {
        legacySendResponseMessage(data);  // Legacy 방식
    }
}

private void legacySendResponseMessage(PluginResult data) {
    String runScript = "window.Capacitor.fromNative(" + data.toString() + ")";
    webView.post(() -> webView.evaluateJavascript(runScript, null));
}
```

**iOS (CapacitorBridge.swift):**

```swift
func toJs(result: JSResultProtocol, save: Bool) {
    let resultJson = result.jsonPayload()
    
    DispatchQueue.main.async {
        self.webView?.evaluateJavaScript("""
            window.Capacitor.fromNative({
                callbackId: '\(result.callbackID)',
                pluginId: '\(result.pluginID)',
                methodName: '\(result.methodName)',
                save: \(save),
                success: true,
                data: \(resultJson)
            })
        """) { (_, error) in
            if let error = error { CAPLog.print(error) }
        }
    }
}
```

### JS 측 응답 수신 (native-bridge.js)

```javascript
// native-bridge.js 내부
const callbacks = new Map();

cap.toNative = (pluginName, methodName, options, storedCall) => {
    const callbackId = generateCallbackId();
    callbacks.set(callbackId, storedCall);
    
    // Native로 메시지 전송
    if (platform === 'android') {
        window.androidBridge.postMessage(JSON.stringify({
            type: 'capacitor',
            pluginId: pluginName,
            methodName: methodName,
            callbackId: callbackId,
            options: options
        }));
    } else if (platform === 'ios') {
        window.webkit.messageHandlers.bridge.postMessage({
            type: 'capacitor',
            pluginId: pluginName,
            methodName: methodName,
            callbackId: callbackId,
            options: options
        });
    }
};

// Native에서 응답 수신
window.Capacitor.fromNative = (result) => {
    const storedCall = callbacks.get(result.callbackId);
    if (storedCall) {
        if (result.error) {
            // Error 객체 복원
            result.error = Object.keys(result.error).reduce((err, key) => {
                err[key] = result.error[key];
                return err;
            }, new cap.Exception(''));
        }
        
        if (typeof storedCall.callback === 'function') {
            // Callback 방식
            if (result.success) {
                storedCall.callback(result.data);
            } else {
                storedCall.callback(null, result.error);
            }
        } else if (typeof storedCall.resolve === 'function') {
            // Promise 방식
            if (result.success) {
                storedCall.resolve(result.data);
            } else {
                storedCall.reject(result.error);
            }
            callbacks.delete(result.callbackId);  // 일회성 Promise 정리
        }
    }
    
    if (result.save === false) {
        callbacks.delete(result.callbackId);
    }
};
```

---

## 5. Plugin 등록 방식

### Android: Bridge를 통한 등록

**1. 자동 등록 (capacitor.config.json 기반)**

```java
// Bridge.java - registerAllPlugins()
private void registerAllPlugins() {
    // Core 플러그인들
    this.registerPlugin(com.getcapacitor.plugin.CapacitorCookies.class);
    this.registerPlugin(com.getcapacitor.plugin.WebView.class);
    this.registerPlugin(com.getcapacitor.plugin.CapacitorHttp.class);
    this.registerPlugin(com.getcapacitor.plugin.SystemBars.class);
    
    // capacitor.config.json에 정의된 플러그인들
    for (Class<? extends Plugin> pluginClass : this.initialPlugins) {
        this.registerPlugin(pluginClass);
    }
    
    // 인스턴스로 전달된 플러그인들
    for (Plugin plugin : pluginInstances) {
        registerPluginInstance(plugin);
    }
}

public void registerPlugin(Class<? extends Plugin> pluginClass) {
    String pluginId = pluginId(pluginClass);
    if (pluginId == null) return;
    
    try {
        this.plugins.put(pluginId, new PluginHandle(this, pluginClass));
    } catch (InvalidPluginException | PluginLoadException ex) {
        // 에러 처리
    }
}

private String pluginId(Class<? extends Plugin> clazz) {
    CapacitorPlugin pluginAnnotation = clazz.getAnnotation(CapacitorPlugin.class);
    String pluginName = pluginAnnotation != null ? pluginAnnotation.name() : getLegacyPluginName(clazz);
    
    String pluginId = clazz.getSimpleName();
    if (pluginName != null && !pluginName.equals("")) {
        pluginId = pluginName;
    }
    return pluginId;
}
```

**2. 수동 등록 (MainActivity에서)**

```java
// MainActivity.java
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 커스텀 플러그인 등록
        registerPlugin(MyCustomPlugin.class);
    }
}
```

**3. PluginHandle을 통한 메서드 인덱싱**

```java
// PluginHandle.java
private void indexMethods(Class<? extends Plugin> plugin) {
    Method[] methods = pluginClass.getMethods();  // 상속된 메서드 포함
    
    for (Method methodReflect : methods) {
        PluginMethod method = methodReflect.getAnnotation(PluginMethod.class);
        if (method == null) continue;
        
        PluginMethodHandle methodMeta = new PluginMethodHandle(methodReflect, method);
        pluginMethods.put(methodReflect.getName(), methodMeta);
    }
}

// 호출 시
public void invoke(String methodName, PluginCall call) throws ... {
    PluginMethodHandle methodMeta = pluginMethods.get(methodName);
    if (methodMeta == null) {
        throw new InvalidPluginMethodException("No method " + methodName + " found");
    }
    methodMeta.getMethod().invoke(this.instance, call);  // 리플렉션 호출
}
```

### iOS: CapacitorBridge를 통한 등록

**1. 자동 등록 (capacitor.config.json 파싱)**

```swift
// CapacitorBridge.swift
func registerPlugins() {
    var pluginList: [AnyClass] = [
        CAPHttpPlugin.self,
        CAPConsolePlugin.self,
        CAPWebViewPlugin.self,
        CAPCookiesPlugin.self,
        CAPSystemBarsPlugin.self
    ]
    
    if autoRegisterPlugins {
        if let pluginJSON = Bundle.main.url(forResource: "capacitor.config", withExtension: "json") {
            let pluginData = try Data(contentsOf: pluginJSON)
            let registrationList = try JSONDecoder().decode(RegistrationList.self, from: pluginData)
            
            for plugin in registrationList.packageClassList {
                if let pluginClass = NSClassFromString(plugin) {
                    pluginList.append(pluginClass)
                }
            }
        }
    }
    
    for plugin in pluginList {
        if let capPlugin = plugin as? CapacitorPlugin.Type {
            registerPlugin(capPlugin)
        }
    }
}

func registerPlugin(_ pluginType: CapacitorPlugin.Type) {
    if let plugin = loadPlugin(type: pluginType) {
        JSExport.exportJS(for: plugin, in: webViewDelegationHandler.contentController)
    }
}

func loadPlugin(type: CAPPlugin.Type) -> CapacitorPlugin? {
    guard let plugin = type.init() as? CapacitorPlugin else { return nil }
    plugin.load(on: self)
    plugins[plugin.jsName] = plugin
    return plugin
}
```

**2. JS Export 생성 (JSExport.swift)**

```swift
static func exportJS(for plugin: CapacitorPlugin, in userContentController: WKUserContentController) {
    var lines = [String]()
    
    lines.append("""
        (function(w) {
        var a = (w.Capacitor = w.Capacitor || {});
        var p = (a.Plugins = a.Plugins || {});
        var t = (p['\(plugin.jsName)'] = {});
        t.addListener = function(eventName, callback) {
            return w.Capacitor.addListener('\(plugin.jsName)', eventName, callback);
        }
        t.removeAllListeners = function() {
            return w.Capacitor.nativePromise('\(plugin.jsName)', 'removeAllListeners');
        }
        """)
    
    for method in plugin.pluginMethods {
        lines.append(generateMethod(pluginClassName: plugin.jsName, method: method))
    }
    
    lines.append("""
        })(window);
        """)
    
    // Plugin Header 등록 (메타데이터)
    if let data = try? JSONEncoder().encode(createPluginHeader(for: plugin)),
       let header = String(data: data, encoding: .utf8) {
        lines.append("""
            (function(w) {
            var a = (w.Capacitor = w.Capacitor || {});
            var h = (a.PluginHeaders = a.PluginHeaders || []);
            h.push(\(header));
            })(window);
            """)
    }
    
    let js = lines.joined(separator: "\n")
    let userScript = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    userContentController.addUserScript(userScript)
}

static func generateMethod(pluginClassName: String, method: CAPPluginMethod) -> String {
    let methodName = method.name!
    let returnType = method.returnType!
    var paramList = [catchallOptionsParameter]  // options 객체
    
    if returnType == CAPPluginReturnCallback {
        paramList.append(callbackParameter)  // callback 파라미터 추가
    }
    
    let paramString = paramList.joined(separator: ", ")
    let argObjectString = catchallOptionsParameter
    
    var lines = [String]()
    lines.append("t['\(methodName)'] = function(\(paramString)) {")
    
    if returnType == CAPPluginReturnNone {
        lines.append("return w.Capacitor.nativeCallback('\(pluginClassName)', '\(methodName)', \(argObjectString));")
    } else if returnType == CAPPluginReturnPromise {
        lines.append("return w.Capacitor.nativePromise('\(pluginClassName)', '\(methodName)', \(argObjectString));")
    } else if returnType == CAPPluginReturnCallback {
        lines.append("return w.Capacitor.nativeCallback('\(pluginClassName)', '\(methodName)', \(argObjectString), \(callbackParameter));")
    }
    
    lines.append("}")
    return lines.joined(separator: "\n")
}
```

**3. 수동 등록**

```swift
// AppDelegate.swift 또는 ViewController에서
let bridge = CapacitorBridge(...)
bridge.registerPluginType(MyCustomPlugin.self)

// 또는 인스턴스 등록
let pluginInstance = MyCustomPlugin()
bridge.registerPluginInstance(pluginInstance)
```

---

## 6. 호출 흐름 단계별 설명

### 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         React/JS 호출 흐름                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. JS 호출
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ MyPlugin.echo({ value: "hello" })                                       │
   │   ↓                                                                     │
   │ Proxy 객체 (registerPlugin으로 생성된 Proxy)                            │
   │   ↓                                                                     │
   │ createPluginMethodWrapper('echo') 호출                                  │
   │   ↓                                                                     │
   │ loadPluginImplementation() → 웹 구현 또는 네이티브 호출 결정            │
   └─────────────────────────────────────────────────────────────────────────┘
                                    ↓
2. 네이티브 호출 결정 (PluginHeader의 rtype 확인)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ rtype === 'promise'  → cap.nativePromise(pluginName, methodName, opts) │
   │ rtype === 'callback' → cap.nativeCallback(pluginName, methodName,      │
   │                                              opts, callback)            │
   │ rtype === 'none'     → cap.nativeCallback(pluginName, methodName,      │
   │                                              opts) (callback 없음)      │
   └─────────────────────────────────────────────────────────────────────────┘
                                    ↓
3. toNative() 호출 (native-bridge.js)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ callbackId 생성 (UUID)                                                  │
   │ callbacks Map에 {callbackId: {resolve, reject} 또는 {callback}} 저장   │
   │                                                                         │
   │ Android: window.androidBridge.postMessage(JSON.stringify({             │
   │     type: 'capacitor', pluginId, methodName, callbackId, options       │
   │ }))                                                                     │
   │                                                                         │
   │ iOS: window.webkit.messageHandlers.bridge.postMessage({                │
   │     type: 'capacitor', pluginId, methodName, callbackId, options       │
   │ })                                                                      │
   └─────────────────────────────────────────────────────────────────────────┘
                                    ↓
4. Native 측 수신 및 디스패치
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ Android: MessageHandler.postMessage()                                   │
   │   → JSON 파싱 → pluginId, methodName, callbackId, options 추출         │
   │   → Bridge.callPluginMethod(pluginId, methodName, call)                │
   │   → PluginHandle.invoke(methodName, call)                              │
   │   → 리플렉션으로 Plugin 인스턴스의 메서드 호출                          │
   │                                                                         │
   │ iOS: CapacitorBridge.handleJSCall(call: JSCall)                        │
   │   → plugins[pluginId]로 플러그인 인스턴스 조회                         │
   │   → selector 생성 (methodName + ":")                                    │
   │   → plugin.perform(selector, with: pluginCall)                         │
   └─────────────────────────────────────────────────────────────────────────┘
                                    ↓
5. 플러그인 메서드 실행
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ @PluginMethod(returnType = "promise") 메서드 내부:                      │
   │   call.resolve(data)  → 성공                                            │
   │   call.reject(err)      → 실패                                          │
   │                                                                         │
   │ @PluginMethod(returnType = "callback") 메서드 내부:                     │
   │   call.setKeepAlive(true)  → 리스너 유지                                │
   │   나중에 call.resolve(data)로 이벤트 데이터 전송                        │
   └─────────────────────────────────────────────────────────────────────────┘
                                    ↓
6. Native → JS 응답 전송
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ Android: MessageHandler.sendResponseMessage()                          │
   │   → PluginResult 구성 (success, data, callbackId, pluginId, methodName)│
   │   → Modern: javaScriptReplyProxy.postMessage()                         │
   │   → Legacy: webView.evaluateJavascript("window.Capacitor.fromNative(...)")│
   │                                                                         │
   │ iOS: CapacitorBridge.toJs()                                            │
   │   → webView.evaluateJavaScript("window.Capacitor.fromNative({...})")   │
   └─────────────────────────────────────────────────────────────────────────┘
                                    ↓
7. JS 측 응답 처리 (native-bridge.js)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ window.Capacitor.fromNative(result) 호출                                │
   │   → callbacks.get(callbackId)로 저장된 호출 정보 조회                   │
   │   │                                                                     │
   │   ├─ Promise: storedCall.resolve(result.data) 또는                     │
   │   │         storedCall.reject(result.error)                            │
   │   │         → callbacks.delete(callbackId) (일회성)                    │
   │   │                                                                     │
   │   └─ Callback: storedCall.callback(result.data) 또는                   │
   │              storedCall.callback(null, result.error)                   │
   │              → keepAlive인 경우 callbacks 유지                          │
   └─────────────────────────────────────────────────────────────────────────┘
```

### 상세 단계별 설명

#### Step 1: JS에서 플러그인 메서드 호출
```typescript
// 사용자 코드
const result = await MyPlugin.echo({ value: "hello" });

// 내부적으로:
MyPlugin.echo → Proxy.get() → createPluginMethodWrapper('echo') 
  → loadPluginImplementation() → cap.nativePromise('MyPlugin', 'echo', {value: "hello"})
```

#### Step 2: nativePromise/nativeCallback 호출
```javascript
// native-bridge.js
cap.nativePromise = (pluginName, methodName, options) => {
    return new Promise((resolve, reject) => {
        cap.toNative(pluginName, methodName, options, { resolve, reject });
    });
};

cap.toNative = (pluginName, methodName, options, storedCall) => {
    const callbackId = generateCallbackId();  // UUID 생성
    callbacks.set(callbackId, storedCall);    // Promise resolver 저장
    
    // 플랫폼별 네이티브 브리지 호출
    if (platform === 'android') {
        window.androidBridge.postMessage(JSON.stringify({
            type: 'capacitor',
            pluginId: pluginName,
            methodName: methodName,
            callbackId: callbackId,
            options: options
        }));
    } else if (platform === 'ios') {
        window.webkit.messageHandlers.bridge.postMessage({...});
    }
};
```

#### Step 3: Android 네이티브 수신 (MessageHandler)
```java
// MessageHandler.java
@JavascriptInterface
public void postMessage(String jsonStr) {
    JSObject postData = new JSObject(jsonStr);
    String type = postData.getString("type");
    
    if ("capacitor".equals(type)) {
        String pluginId = postData.getString("pluginId");
        String methodName = postData.getString("methodName");
        String callbackId = postData.getString("callbackId");
        JSObject methodData = postData.getJSObject("options", new JSObject());
        
        // PluginCall 생성 및 Bridge로 전달
        PluginCall call = new PluginCall(this, pluginId, callbackId, methodName, methodData);
        bridge.callPluginMethod(pluginId, methodName, call);
    }
}
```

#### Step 4: Bridge → PluginHandle → Plugin 메서드 호출
```java
// Bridge.java
public void callPluginMethod(String pluginId, String methodName, PluginCall call) {
    PluginHandle plugin = this.getPlugin(pluginId);
    if (plugin == null) { call.errorCallback("plugin not found"); return; }
    
    // 백그라운드 스레드에서 실행
    taskHandler.post(() -> {
        try {
            plugin.invoke(methodName, call);  // PluginHandle.invoke()
        } catch (Exception ex) { ... }
    });
}

// PluginHandle.java
public void invoke(String methodName, PluginCall call) throws ... {
    if (this.instance == null) this.load();  // 지연 로딩
    
    PluginMethodHandle methodMeta = pluginMethods.get(methodName);
    if (methodMeta == null) throw new InvalidPluginMethodException(...);
    
    // 리플렉션으로 실제 메서드 호출
    methodMeta.getMethod().invoke(this.instance, call);
}
```

#### Step 5: 플러그인 메서드 실행 및 응답
```java
// MyPlugin.java
@PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
public void echo(PluginCall call) {
    String value = call.getString("value");
    
    // 성공 응답
    JSObject result = new JSObject();
    result.put("value", value);
    call.resolve(result);  // → MessageHandler.sendResponseMessage()
    
    // 또는 실패 응답
    // call.reject("Error message", "ERROR_CODE", exception, data);
}
```

#### Step 6: Native → JS 응답 전송
```java
// MessageHandler.java
public void sendResponseMessage(PluginCall call, PluginResult success, PluginResult error) {
    PluginResult data = new PluginResult();
    data.put("save", call.isKeptAlive());
    data.put("callbackId", call.getCallbackId());
    data.put("pluginId", call.getPluginId());
    data.put("methodName", call.getMethodName());
    
    if (error != null) {
        data.put("success", false);
        data.put("error", error);
    } else {
        data.put("success", true);
        if (success != null) data.put("data", success);
    }
    
    // Modern WebView (Android 7+): WebMessageListener 사용
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) 
        && javaScriptReplyProxy != null) {
        javaScriptReplyProxy.postMessage(data.toString());
    } else {
        // Legacy: evaluateJavascript 사용
        String runScript = "window.Capacitor.fromNative(" + data.toString() + ")";
        webView.post(() -> webView.evaluateJavascript(runScript, null));
    }
}
```

#### Step 7: JS에서 응답 수신 및 Promise 해결
```javascript
// native-bridge.js
window.Capacitor.fromNative = (result) => {
    const storedCall = callbacks.get(result.callbackId);
    if (storedCall) {
        if (result.error) {
            // Error 객체 복원
            result.error = Object.keys(result.error).reduce((err, key) => {
                err[key] = result.error[key];
                return err;
            }, new cap.Exception(''));
        }
        
        if (typeof storedCall.callback === 'function') {
            // Callback 방식 (addListener 등)
            if (result.success) storedCall.callback(result.data);
            else storedCall.callback(null, result.error);
        } else if (typeof storedCall.resolve === 'function') {
            // Promise 방식
            if (result.success) storedCall.resolve(result.data);
            else storedCall.reject(result.error);
            
            // Promise는 일회성이므로 삭제
            callbacks.delete(result.callbackId);
        }
    }
    
    if (result.save === false) {
        callbacks.delete(result.callbackId);
    }
};
```

---

## 7. 주요 차이점 요약: Android vs iOS

| 측면 | Android | iOS |
|------|---------|-----|
| **플러그인 기본 클래스** | `Plugin` (abstract class) | `CAPBridgedPlugin` (protocol) |
| **메서드 어노테이션** | `@PluginMethod` | `CAP_PLUGIN_METHOD` 매크로 |
| **반환 타입 상수** | `PluginMethod.RETURN_PROMISE` 등 | `CAPPluginReturnPromise` 등 |
| **플러그인 등록** | `Bridge.registerPlugin(Class)` | `CapacitorBridge.registerPlugin(Type)` |
| **메서드 인덱싱** | 리플렉션 (`getMethods()`) | 컴파일 타임 매크로로 배열 생성 |
| **메서드 호출** | `Method.invoke(instance, call)` | `perform(selector, with: call)` |
| **JS 브리지** | `JavascriptInterface` / `WebMessage