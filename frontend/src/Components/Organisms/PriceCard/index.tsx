// #region Global Imports
import { MouseEventHandler, ReactNode } from "react"
// #endregion Global Imports

// #region Local Imports
import styles from "./PriceCard.module.scss"
import { Button } from "@Components"
import classNames from "classnames"
import { useTranslation } from "next-i18next"

// #endregion Local Imports
interface Props {
    children?: ReactNode
    onClick?: MouseEventHandler
    title?: string
    unit?: string
    price?: string
    priceChange?: string
    isOpen?: boolean
}

const formatComma = function (v: string | null) {
    if (v === null) return "0"
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const PriceCard = (props: Props): JSX.Element => {
    const { title, unit, price, priceChange, isOpen, children, onClick } = props
    const { t } = useTranslation("common")
    const formattedPrice = formatComma(price || null)
    const formattedPriceChange = formatComma(priceChange || null)
    const isChangePlus = formattedPriceChange !== undefined && 0 <= Number(formattedPriceChange?.replace(/,/g, ""))
    return (
        <div className={styles["price-card"]}>
            <div className={styles["price-card__con"]} onClick={onClick}>
                <div className={styles["price-card__header"]}>
                    <h2 className={styles["price-card__title"]}>{t("main." + title)}</h2>
                    <span className={styles["price-card__unit"]}>
                        {t("word.unit")}: {t("main.unit." + unit)}
                    </span>
                </div>
                {formattedPrice !== "0" ? (
                    <div>
                        <strong className={styles["price-card__price"]}>
                            {formattedPrice}
                            <span className={styles["price-card__price-unit"]}>{t("word.won")}</span>
                        </strong>
                        <span
                            className={classNames({
                                [styles["price-card__price-change"]]: true,
                                [styles["price-card__price-change--minus"]]: isChangePlus === false,
                            })}
                        >
                            <img src={isChangePlus ? "/static/images/arr_price_up.svg" : "/static/images/arr_price_down.svg"} alt="" />
                            {formattedPriceChange?.split("-")}
                            <span className={styles["price-card__price-unit"]}>{t("word.won")}</span>
                        </span>
                    </div>
                ) : (
                    <div>
                        <strong className={styles["price-card__price"]}>{t("word.unregistered")}</strong>
                        <span className={styles["price-card__price-change"]}></span>
                    </div>
                )}
                {formattedPrice === "0" ? (
                    ""
                ) : isOpen !== true ? (
                    <Button icon={<img src="/static/images/icon_plus.svg" alt={t("message.open-chart")} />} />
                ) : (
                    <Button icon={<img src="/static/images/icon_minus.svg" alt={t("message.close-chart")} />} />
                )}
            </div>
            <div
                className={classNames({
                    [styles["price-card__chart"]]: true,
                    [styles["price-card__chart--show"]]: isOpen,
                })}
            >
                {children}
            </div>
        </div>
    )
}
export default PriceCard
