// #region Global Imports
import { useEffect, useState } from "react"
// #endregion Global Imports

// #region Local Imports
import { RN_API } from "@Definitions"
import { WebViewMessage } from "@Services"
// #endregion Local Imports

const useAppVersion = () => {
    const [version, setVerion] = useState<string | null>(null)
    const setVersion = async () => {
        const data = await WebViewMessage<typeof RN_API.GET_VERSION>(RN_API.GET_VERSION)
        setVerion(data)
    }
    useEffect(() => {
        setVersion()
    }, [])
    return [version]
}
export default useAppVersion
