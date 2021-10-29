import styled from "styled-components"

const StyledTournament = styled.ol`
    padding: 10px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    max-width: 600px;
    /* border:1px solid; */
    & > li {
        position: relative;
        padding: 0 40px 0 0;
        & > button {
            z-index: 9;
            position: absolute;
            transform: translate(0, -50%);
            top: 50%;
            right: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 18px;
            height: 18px;
            border: 1px solid;
        }
        &:last-child > button {
            right: auto;
            left: 50px;
        }
        &::before {
            content: "";
            position: absolute;
            transform: translate(0, -50%);
            top: 50%;
            right: 0;
            display: block;
            width: 40px;
            height: 2px;
            background: #000;
        }
        &:first-child::after {
            content: "";
            position: absolute;
            transform: translate(50%, -100%);
            top: 50%;
            right: 0;
            display: block;
            width: 2px;
            height: 40px;
            background: #000;
        }
        &.s_win:first-child::after,
        &.s_win::before {
            background: #ff8989;
            z-index: 9;
        }
        &:last-child {
            & li > button {
                right: auto;
                left: 50px;
            }
            &::before {
                right: auto;
                left: 0;
            }
            padding: 0 0 0 40px;
            & li {
                padding: 0 0 0 40px;
            }
            & li::before {
                right: auto;
                left: 0;
            }
            & li::after {
                right: auto;
                left: 0;
            }
        }
    }
`
const StyledTournamentInner = styled.ol`
    margin: 0 auto;
    display: flex;
    width: 100%;
    height: 100%;
    flex-direction: column;
    /* border:1px solid; */
    & > li {
        padding: 0 40px 0 0;
        position: relative;
        & > button {
            z-index: 9;
            position: absolute;
            transform: translate(0, -50%);
            top: 50%;
            right: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 18px;
            height: 18px;
            border: 1px solid;
        }
        &::before {
            content: "";
            position: absolute;
            transform: translate(0, -50%);
            top: 50%;
            right: 0;
            display: block;
            width: 40px;
            height: 2px;
            background: #000;
        }
        &::after {
            content: "";
            position: absolute;
            bottom: 0;
            right: 0;
            display: block;
            width: 2px;
            height: 50%;
            background: #000;
        }
        &:last-child::after {
            top: 0;
            bottom: auto;
        }
        &.s_no-match::before,
        &.s_win::before,
        &.s_win::after {
            background: #ff8989;
            z-index: 9;
        }
        &.s_no-match {
            & > div {
                height: 80px;
            }
            &::after {
                display: none;
            }
        }
    }
`
const StyledTournamentPlayer = styled.div`
    height: 40px;
    width: 80px;
    border: 1px solid;
`

const Page = function () {
    return (
        <main id="contents" className="l_main">
            <StyledTournament>
                <li>
                    <StyledTournamentInner>
                        <li className="s_win">
                            <StyledTournamentPlayer></StyledTournamentPlayer>
                        </li>
                        <li>
                            <StyledTournamentPlayer></StyledTournamentPlayer>
                        </li>
                    </StyledTournamentInner>
                    <button>1</button>
                </li>
                <li>
                    <StyledTournamentInner>
                        <li className="s_win">
                            <StyledTournamentPlayer></StyledTournamentPlayer>
                        </li>
                        <li>
                            <StyledTournamentPlayer></StyledTournamentPlayer>
                        </li>
                    </StyledTournamentInner>
                    <button>1</button>
                </li>
            </StyledTournament>
            <StyledTournament>
                <li>
                    <StyledTournamentInner>
                        <li>
                            <StyledTournamentInner>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li className="s_win">
                                                    <StyledTournamentInner>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                    <button>1</button>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li className="s_no-match">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                            <button>2</button>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li className="s_win">
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                    <button>1</button>
                                </li>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li className="s_win">
                                                    <StyledTournamentInner>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                </li>
                            </StyledTournamentInner>
                            <button>1</button>
                        </li>
                        <li>
                            <StyledTournamentInner>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                </li>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                </li>
                            </StyledTournamentInner>
                            <button>1</button>
                        </li>
                    </StyledTournamentInner>
                </li>
                <li>
                    <StyledTournamentInner>
                        <li>
                            <StyledTournamentInner>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li className="s_win">
                                                    <StyledTournamentInner>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                    <button>1</button>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li className="s_no-match">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                            <button>2</button>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li className="s_win">
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                    <button>1</button>
                                </li>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li className="s_win">
                                                    <StyledTournamentInner>
                                                        <li className="s_win">
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                </li>
                            </StyledTournamentInner>
                            <button>1</button>
                        </li>
                        <li>
                            <StyledTournamentInner>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                </li>
                                <li>
                                    <StyledTournamentInner>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                        <li>
                                            <StyledTournamentInner>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                                <li>
                                                    <StyledTournamentInner>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                        <li>
                                                            <StyledTournamentPlayer></StyledTournamentPlayer>
                                                        </li>
                                                    </StyledTournamentInner>
                                                </li>
                                            </StyledTournamentInner>
                                        </li>
                                    </StyledTournamentInner>
                                </li>
                            </StyledTournamentInner>
                            <button>1</button>
                        </li>
                    </StyledTournamentInner>
                </li>
            </StyledTournament>
        </main>
    )
}
export default Page
