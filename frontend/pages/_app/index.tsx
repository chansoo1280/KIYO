// #region Global Imports
import "/styles/style.scss"
import "/styles/reset.css"
// Import Swiper styles
import "swiper/swiper.scss"
import * as React from "react"
import App, { AppInitialProps, AppContext } from "next/app"
import { withRouter } from "next/router"
import { ThemeProvider } from "styled-components"
import { connect, ReactReduxContext } from "react-redux"
import { PersistGate } from "redux-persist/integration/react"
import { CSSTransition, TransitionGroup } from "react-transition-group"
import { appWithTranslation } from "next-i18next"
// #endregion Global Imports

// #region Local Imports
import { ThemeObj, ThemeType } from "@Definitions/Styled"
import { AppWithStore } from "@Interfaces"
import { RootState, wrapper } from "@Redux"
import TheLayout, { LayoutCode } from "@Components/Layout"
import "@Services/API/DateFormat"
// #endregion Local Imports

class WebApp extends App<AppWithStore> {
    constructor(props: any) {
        super(props)
        this.state = {
            nextPathname: this.formatPathname(this.props.router.pathname),
            prevPathname: this.formatPathname(this.props.router.pathname),
        }
    }
    static async getInitialProps({ Component, ctx }: AppContext): Promise<AppInitialProps> {
        const pageProps = Component.getInitialProps ? await Component.getInitialProps(ctx) : {}

        return { pageProps: pageProps }
    }
    formatPathname = (url: string) => {
        return url
            .replace(/[0-9]{1,}\//g, "")
            .replace("/[seq]", "")
            .replace("en/", "")
    }
    handleRouteChange = (url: string) => {
        this.setState({
            ...this.state,
            nextPathname: this.formatPathname(url.split("?")[0]),
            prevPathname: this.formatPathname(this.props.router.pathname),
        })
    }
    componentDidMount() {
        this.props.router.events.on("routeChangeStart", this.handleRouteChange)
    }
    componentWillUnmount() {
        this.props.router.events.off("routeChangeStart", this.handleRouteChange)
    }
    render() {
        const { Component, pageProps, router, app }: any = this.props
        const { nextPathname, prevPathname }: any = this.state
        const AppLayout = TheLayout[pageProps?.layout || LayoutCode.Default]
        const theme = ThemeObj[ThemeType[app.sel_theme] || ThemeType.WHITE]

        return (
            <ThemeProvider theme={theme}>
                <ReactReduxContext.Consumer>
                    {({ store }: any) => (
                        <PersistGate
                            persistor={store.__persistor}
                            loading={
                                <div className="l_loading">
                                    <img src="/static/images/splash_bg.svg" alt="알고싶은 서울물가" />
                                </div>
                            }
                        >
                            <TransitionGroup className="l_transition-wrap">
                                <CSSTransition
                                    key={router.pathname}
                                    timeout={{
                                        enter: 300,
                                        exit: 290,
                                    }}
                                    classNames={pageProps?.transition || ""}
                                >
                                    <div className={"l_transition " + nextPathname + "From" + prevPathname}>
                                        <AppLayout {...pageProps}>
                                            <Component {...pageProps} />
                                        </AppLayout>
                                    </div>
                                </CSSTransition>
                            </TransitionGroup>
                        </PersistGate>
                    )}
                </ReactReduxContext.Consumer>
            </ThemeProvider>
        )
    }
}
const mapStateToProps = (state: RootState) => ({
    app: state.appReducer,
})

export default wrapper.withRedux(connect(mapStateToProps)(withRouter(appWithTranslation(WebApp))))
