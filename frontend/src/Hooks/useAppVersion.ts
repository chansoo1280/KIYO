// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
// #endregion Local Imports

const useAppVersion = () => {
    const [version, setVersion] = useState<string | null>(null)
    const getVersion = () =>
        WebViewMessage<typeof RN_API.GET_VERSION>(RN_API.GET_VERSION).then((res) => {
            setVersion(res)
            return res
        })
    return { version, getVersion }
}
export default useAppVersion
