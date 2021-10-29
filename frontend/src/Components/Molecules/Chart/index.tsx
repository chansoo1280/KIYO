// #region Global Imports
import React, { useEffect, useState } from "react"
import "c3/c3.css"
// #endregion Global Imports

// #region Local Imports
import styles from "./Chart.module.scss"
import { useTranslation } from "next-i18next"
// #endregion Local Imports
interface Props {
    children?: React.ReactNode
    noPadding?: boolean
    dateList?: any
    dataList?: any
    seq?: string | number
    MONTH_BIAS: number
}
const formatComma = function (v: string) {
    if (v === null) return "0"
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const Chart = (props: Props): JSX.Element => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const c3 = require("c3")
    const { t } = useTranslation("common")
    const [chart, setChart] = useState<any>(null)
    const { dataList, dateList, seq, MONTH_BIAS } = props
    const minDate = (() => {
        const d = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        const monthOfYear = d.getMonth()
        d.setMonth(monthOfYear - (4 - MONTH_BIAS))
        return d
    })()

    useEffect(function () {
        const chartObj = c3.generate({
            bindto: "#chart_" + seq,
            data: {
                x: "Dates",

                // xFormat: "%Y-%m-%d",
                // columns: [
                //     ["Dates", "2020-07-01", "2020-08-01", "2020-09-01", "2020-10-01", "2020-11-01", "2020-12-01"],
                //     ["쇠고기", 2985, 2997, 3267, 3227, 3202, 3302],
                // ],
                columns: [],
                labels: {
                    format: function (v: any, id: any, i: any, j: any) {
                        if (i === 0) return ""
                        if (v === null) return null
                        return formatComma(v) + t("word.won")
                    },
                },
            },
            padding: {
                right: 40,
            },
            tooltip: {
                format: {
                    // title: function (d) { return 'Data ' + d; },
                    value: function (v: any, id: any, i: any, j: any) {
                        return formatComma(v) + t("word.won")
                    },
                    //            value: d3.format(',') // apply this format to both y and y2
                },
            },
            line: {
                connect_null: false,
            },
            point: {
                r: 4.5,
            },
            legend: {
                show: false,
            },
            axis: {
                x: {
                    type: "timeseries",
                    tick: {
                        format: function (x: any, i: any, j: any) {
                            if (x <= minDate) return ""
                            return x.getMonth() + 1 + t("word.month")
                        },
                    },
                },
                y: {
                    padding: { top: 200, bottom: 200 },
                },
            },
        })
        setChart(chartObj)
        return () => setChart(null)
    }, [])
    useEffect(() => {
        if (chart && dataList && dateList)
            chart.load({
                unload: true,
                x: "Dates",
                colors: {
                    [dataList[0]]: "#000000",
                },
                columns: [dateList, dataList],
                labels: {
                    format: function (v: any) {
                        return formatComma(v) + t("word.won")
                    },
                },
            })
    }, [chart, dataList, dateList])
    return (
        <div className={styles["chart"]}>
            <div style={{ height: "240px" }} id={"chart_" + seq}></div>
        </div>
    )
}
export default Chart
