// #region Global Imports
import * as React from "react"
import { NextPage } from "next"
// #endregion Global Imports

// #region Interface Imports
// #endregion Interface Imports

const Error: NextPage<{
    statusCode: React.ReactNode
}> = ({
    // t,
    statusCode,
}) => {
    return (
        <div>
            {/* {t("common:Error")} */}
            error
            {statusCode}
        </div>
    )
}

Error.getInitialProps = async ({ res, err }) => {
    let statusCode

    if (res) {
        ;({ statusCode } = res)
    } else if (err) {
        ;({ statusCode } = err)
    }

    return {
        namespacesRequired: ["common"],
        statusCode,
    }
}

export default Error
// export default withTranslation("common")(Error);
