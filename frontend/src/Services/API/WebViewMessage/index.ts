import { RN_API, RN_API_REQ_TYPES, RN_API_RES_TYPES } from "@Definitions/MainConsts"

declare global {
    interface Window {
        ReactNativeWebView: any
    }
}
export const WebViewMessage = async <T extends RN_API>(
    type: RN_API,
    data?: RN_API_REQ_TYPES[T],
): Promise<RN_API_RES_TYPES[T] | null> =>
    new Promise((resolve, reject) => {
        if (!window.ReactNativeWebView) {
            // alert('ReactNativeWebView 객체가 없습니다.');
            reject("ReactNativeWebView 객체가 없습니다.")
            return
        }
        const reqId = Date.now() // uuid로 구현해도 좋습니다.
        const TIMEOUT = 3000 // 3 * 1000 = 3s
        const timer = setTimeout(() => {
            /** android */
            document.removeEventListener("message", listener)
            /** ios */
            window.removeEventListener("message", listener)
            reject("TIMEOUT")
        }, TIMEOUT)
        const listener = (event: any) => {
            const {
                data: listenerData,
                type: listenerType,
                reqId: listenerReqId,
            }: { data: RN_API_RES_TYPES[T]; type: RN_API; reqId: typeof reqId } = JSON.parse(event.data)
            if (
                (listenerReqId === undefined && listenerType === type) ||
                (listenerReqId !== undefined && listenerReqId === reqId)
            ) {
                clearTimeout(timer)
                /** android */
                document.removeEventListener("message", listener)
                /** ios */
                window.removeEventListener("message", listener)
                resolve(listenerData)
            }
        }
        window.ReactNativeWebView.postMessage(
            JSON.stringify({
                type,
                data,
                reqId,
            }),
        )
        /** android */
        document.addEventListener("message", listener)
        /** ios */
        window.addEventListener("message", listener)
    })
