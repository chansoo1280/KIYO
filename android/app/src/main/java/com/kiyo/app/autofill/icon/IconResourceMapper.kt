package com.kiyo.app.autofill.icon

import android.content.Context
import android.util.Log
import com.kiyo.app.R
import com.kiyo.app.autofill.repository.AutofillRepository

/**
 * 사이트 아이콘 리소스 매퍼
 * 계정의 도메인/패키지명에 따라 적절한 아이콘 리소스 ID 반환
 */
object IconResourceMapper {

    private const val TAG = "IconResourceMapper"

    // 웹사이트 프리셋 아이콘 매핑
    private val websiteIconMap = mapOf(
        "google.com" to R.drawable.google,
        "accounts.google.com" to R.drawable.google,
        "microsoft.com" to R.drawable.ic_default_site,
        "accounts.microsoft.com" to R.drawable.ic_default_site,
        "login.microsoftonline.com" to R.drawable.ic_default_site,
        "apple.com" to R.drawable.apple,
        "appleid.apple.com" to R.drawable.apple,
        "naver.com" to R.drawable.naver,
        "id.naver.com" to R.drawable.naver,
        "kakao.com" to R.drawable.ic_kakao,
        "accounts.kakao.com" to R.drawable.ic_kakao,
        "auth.kakao.com" to R.drawable.ic_kakao,
        "github.com" to R.drawable.github,
        "facebook.com" to R.drawable.facebook,
        "twitter.com" to R.drawable.ic_twitter,
        "x.com" to R.drawable.ic_twitter,
        "instagram.com" to R.drawable.instagram,
        "amazon.com" to R.drawable.amazon,
        "netflix.com" to R.drawable.netflix,
        "discord.com" to R.drawable.discord,
        "dropbox.com" to R.drawable.dropbox,
        "steam.com" to R.drawable.steam
        // Note: Microsoft 아이콘은 저작권 문제로 제외됨 (TRADEMARK ENFORCEMENT)
        // 도메인 매칭은 유지하되 기본 아이콘(ic_default_site)으로 fallback
    )

    /**
     * 계정에 맞는 사이트 아이콘 리소스 ID 반환
     * 우선순위: 1) 계정 커스텀 아이콘 2) 웹사이트 프리셋 아이콘 3) 기본 아이콘
     */
    fun getSiteIconResource(account: AutofillRepository.AutofillAccount): Int {
        // 1. 계정 커스텀 아이콘이 있는 경우 (나중에 구현 가능)
        // if (account.iconResourceId != null) return account.iconResourceId!!

        // 2. 도메인 기반 웹사이트 프리셋 아이콘
        val domain = account.domain?.lowercase() ?: ""
        val packageNames = account.packageNames

        // 도메인으로 매칭 시도
        for ((key, iconRes) in websiteIconMap) {
            if (domain.contains(key, true)) {
                Log.d(TAG, "Matched website icon for domain '$domain': $key -> $iconRes")
                return iconRes
            }
        }

        // 패키지명으로 매칭 시도
        for (pkg in packageNames) {
            val pkgLower = pkg.lowercase()
            for ((key, iconRes) in websiteIconMap) {
                if (pkgLower.contains(key, true)) {
                    Log.d(TAG, "Matched website icon for package '$pkg': $key -> $iconRes")
                    return iconRes
                }
            }
        }

        // 3. 기본 아이콘
        Log.d(TAG, "Using default icon for domain='$domain', packages=$packageNames")
        return R.drawable.ic_default_site
    }

    /**
     * 도메인 문자열로 아이콘 리소스 ID 반환 (간편 메서드)
     */
    fun getIconResourceForDomain(domain: String): Int {
        val domainLower = domain.lowercase()
        for ((key, iconRes) in websiteIconMap) {
            if (domainLower.contains(key, true)) {
                return iconRes
            }
        }
        return R.drawable.ic_default_site
    }
}