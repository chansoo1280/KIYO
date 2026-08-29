package com.kiyo.app.e2e.testutil

import java.util.concurrent.atomic.AtomicLong

/**
 * 테스트별 유니크한 데이터 생성을 위한 팩토리.
 * 타임스탬프 + 카운터 조합으로 병렬 실행 시에도 충돌 방지.
 *
 * 핵심: 자동완성 테스트 호스트 앱(`com.kiyo.autofilltest`)과 매칭되도록
 * 기본 `packageName`을 `com.kiyo.autofilltest`로 설정.
 *
 * DB 조작, 키 생성, 암호화 등은 하지 않음 - 순수 데이터만 생성.
 */
object TestDataFactory {

    private val counter = AtomicLong(0)

    private fun nextId(): Long = System.currentTimeMillis() * 1000 + counter.incrementAndGet()

    data class VaultInfo(
        val fileName: String,
        val pin: String? = null
    )

    data class AccountInfo(
        val title: String,
        val websiteUrl: String,
        val domain: String,
        val packageName: String,  // 자동완성 매칭용 패키지명 (필수)
        val username: String,
        val password: String,
        val memo: String? = null
    )

    /** 유니크한 볼트 파일명 생성 (암호화/비암호화 구분 가능) */
    fun uniqueVaultName(encrypted: Boolean = true): String {
        val prefix = if (encrypted) "e2e-vault-enc" else "e2e-vault-plain"
        // .json 제외 - FileCreateDialog에서 자동으로 붙여줌 (input에는 순수 이름만 입력)
        return "$prefix-${nextId()}"
    }

    /** 테스트용 고정 PIN */
    const val TEST_PIN = "1234"

    /**
     * 볼트 파일명에서 계정을 결정적으로 도출.
     * 같은 vaultName이면 항상 같은 username — 세션 간 sharedAccount 불일치 제거.
     * (구 E2EEnv.accountForVault — 데이터 도출이므로 팩토리로 이동, 2026-08-28)
     */
    fun accountForVault(vaultName: String): AccountInfo {
        val seed = vaultName.hashCode().toLong().let { if (it == Long.MIN_VALUE) 0 else Math.abs(it) }
        val id = "v$seed"
        return AccountInfo(
            title = "Test Account $id",
            websiteUrl = "https://example.com",
            domain = "example.com",
            packageName = "com.kiyo.autofilltest",
            username = "user$id",
            password = "pass$id",
            memo = "Test memo $id"
        )
    }
}
