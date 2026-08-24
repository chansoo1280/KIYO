package com.kiyo.app.autofill.testutil

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

    /** 유니크한 계정 정보 생성
     *  - 기본 packageName: "com.kiyo.autofilltest" (테스트 호스트 앱 패키지)
     *  - 이 패키지명으로 계정을 생성해야 테스트 호스트에서 자동완성 드롭다운에 나타남
     */
    fun uniqueAccount(
        domain: String = "example.com",
        packageName: String = "com.kiyo.autofilltest"  // 테스트 호스트 앱과 매칭
    ): AccountInfo {
        val id = nextId()
        return AccountInfo(
            title = "Test Account $id",
            websiteUrl = "https://$domain",
            domain = domain,
            packageName = packageName,
            username = "user$id",
            password = "pass$id",
            memo = "Test memo $id"
        )
    }

    /** 특정 도메인/패키지명으로 계정 생성 */
    fun accountForDomain(
        domain: String,
        packageName: String = "com.kiyo.autofilltest"
    ): AccountInfo {
        return uniqueAccount(domain, packageName)
    }

    /** 다중 계정 생성 (동일 도메인, 동일 패키지명) */
    fun multipleAccountsForDomain(
        count: Int,
        domain: String,
        packageName: String = "com.kiyo.autofilltest"
    ): List<AccountInfo> {
        return (1..count).map { i ->
            val id = nextId()
            AccountInfo(
                title = "Test Account $id-$i",
                websiteUrl = "https://$domain",
                domain = domain,
                packageName = packageName,
                username = "user$id-$i",
                password = "pass$id-$i"
            )
        }
    }

    /** PIN 생성 (4자리) */
    fun randomPin(): String = String.format("%04d", (1000..9999).random())

    /** 테스트용 고정 PIN (디버깅용) */
    const val TEST_PIN = "1234"

    /** AccountCreatePage.kt에서 사용할 AccountData (웹 UI 필드만) */
    data class AccountData(
        val title: String = "Test Account",
        val websiteUrl: String = "https://example.com",
        val username: String = "testuser",
        val password: String = "testpass123",
        val memo: String? = null,
        val packageName: String? = null
    )
}