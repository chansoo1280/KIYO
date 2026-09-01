---
type: android-component
title: Icon Resource Mapper
description: Maps a website/app domain or package name to a drawable resource id used in autofill UI.
tags: [android, icon, drawable, autofill-ui]
---

# IconResourceMapper

`/android/app/src/main/java/com/kiyo/app/autofill/icon/IconResourceMapper.kt` resolves a `domain` or `packageName` to a drawable resource used in the autofill dataset UI.

## Purpose

The autofill dataset card displays an icon next to each suggested credential. The mapper chooses between:

- A site-specific drawable (e.g., `amazon.xml`, `github.xml`, `google.xml`) when the domain is recognized.
- `ic_default_site.xml` for unknown web domains.
- A package-specific drawable (e.g., `ic_kakao.xml`, `netflix.xml`) for Android apps.
- `ic_default.xml` for unknown packages.

## Recognized sites

The mapper maintains a static lookup table keyed on hostname:

```kotlin
val SITE_ICONS = mapOf(
    "amazon.com" to R.drawable.amazon,
    "apple.com" to R.drawable.apple,
    "discord.com" to R.drawable.discord,
    "dropbox.com" to R.drawable.dropbox,
    "facebook.com" to R.drawable.facebook,
    "github.com" to R.drawable.github,
    "google.com" to R.drawable.google,
    "instagram.com" to R.drawable.instagram,
    "kakaotalk.com" to R.drawable.kakaotalk,
    "naver.com" to R.drawable.naver,
    "netflix.com" to R.drawable.netflix,
    "twitter.com" to R.drawable.ic_twitter,
    "x.com" to R.drawable.x,
)
```

The matcher is case-insensitive and tolerates `www.` prefix and any subdomain (`accounts.google.com` → `google.com`).

## Recognized packages

```kotlin
val PACKAGE_ICONS = mapOf(
    "com.netflix.mediaclient" to R.drawable.netflix,
    "com.kakao.talk" to R.drawable.ic_kakao,
    "com.discord" to R.drawable.discord,
    // ...
)
```

## API

```kotlin
object IconResourceMapper {
    fun resolveForDomain(domain: String?): Int
    fun resolveForPackage(packageName: String?): Int
    fun resolve(domain: String?, packageName: String?): Int
}
```

`resolve` prefers the package icon when a recognized package exists, falling back to the domain icon, then to the default drawable.

## Source Anchors

- `IconResourceMapper.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/icon/IconResourceMapper.kt`
- Drawable resources — `/android/app/src/main/res/drawable/*.xml`
- Default fallback — `/android/app/src/main/res/drawable/ic_default.xml`
- Default site fallback — `/android/app/src/main/res/drawable/ic_default_site.xml`