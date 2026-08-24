package com.kiyo.app.autofill.detection

import android.view.autofill.AutofillId

/**
 * 필드 후보 데이터 클래스
 * 점수 기반 필드 탐지 시스템에서 사용
 */
data class FieldCandidate(
    val autofillId: AutofillId,
    val score: Int,
    val className: String,
    val autofillHints: String,
    val hint: String,
    val inputType: String,
    val htmlInputType: String?,
    val htmlAutocomplete: String?,
    val htmlName: String?,
    val webDomain: String,
    val reason: String
)