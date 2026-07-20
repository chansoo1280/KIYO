package com.kiyo.app.autofill

import android.content.Context
import android.util.Log
import com.kiyo.app.R

/**
 * 사이트 아이콘 리소스 매퍼
 * 계정의 도메인/패키지명에 따라 적절한 아이콘 리소스 ID 반환
 */
object IconResourceMapper {

    private const val TAG = "IconResourceMapper"

    // 웹사이트 프리셋 아이콘 매핑
    private val websiteIconMap = mapOf(
        "google.com" to R.drawable.ic_google,
        "accounts.google.com" to R.drawable.ic_google,
        "microsoft.com" to R.drawable.ic_microsoft,
        "accounts.microsoft.com" to R.drawable.ic_microsoft,
        "login.microsoftonline.com" to R.drawable.ic_microsoft,
        "apple.com" to R.drawable.ic_apple,
        "appleid.apple.com" to R.drawable.ic_apple,
        "naver.com" to R.drawable.ic_naver,
        "id.naver.com" to R.drawable.ic_naver,
        "kakao.com" to R.drawable.ic_kakao,
        "accounts.kakao.com" to R.drawable.ic_kakao,
        "auth.kakao.com" to R.drawable.ic_kakao,
        "github.com" to R.drawable.ic_github,
        "facebook.com" to R.drawable.ic_facebook,
        "twitter.com" to R.drawable.ic_twitter,
        "x.com" to R.drawable.ic_twitter,
        "instagram.com" to R.drawable.ic_instagram,
        "amazon.com" to R.drawable.ic_amazon,
        "netflix.com" to R.drawable.ic_netflix,
        "discord.com" to R.drawable.ic_discord,
        "dropbox.com" to R.drawable.ic_dropbox,
        "steam.com" to R.drawable.ic_steam
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