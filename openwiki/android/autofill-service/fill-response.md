---
type: android-component
title: Fill Response Builder
description: FillResponseBuilder and DatasetFactory - construct AutofillFramework FillResponse objects for fills and auth prompts.
tags: [android, autofill, fill-response, dataset]
---

# FillResponseBuilder

`/android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt` constructs the `FillResponse` objects returned to the system Autofill Framework.

## API

```kotlin
object FillResponseBuilder {
    fun createAuthResponse(
        context: Context,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): FillResponse

    fun createFillResponse(
        context: Context,
        accounts: List<AutofillRepository.AutofillAccount>,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): FillResponse
}
```

## createAuthResponse

Used when `DatabaseKeyManager.getKey` throws `UserNotAuthenticatedException` and the system needs to display an authentication prompt. The returned `FillResponse` contains a single dataset with no actual fill values, but presents an auth intent:

```kotlin
val authIntent = Intent(context, AutofillAuthActivity::class.java)
val presentation = RemoteViews(packageName, R.layout.autofill_auth_item)
val dataset = Dataset.Builderpresentation.setAuthentication(authIntent.intentSender)
val response = FillResponse.Builder
    .addDataset(dataset.build())
    .build()
```

The user, on choosing KIYO from the autofill chooser, is taken to `AutofillAuthActivity` (theme `Theme.Kiyo.AutofillAuth`). After confirmation, the autofill framework re-issues `onFillRequest`.

If either `usernameId` or `passwordId` is null, the function returns a minimal `FillResponse` with the auth-only dataset.

## createFillResponse

Used after a successful repository lookup. Each matched `AutofillAccount` becomes a `Dataset`:

```kotlin
val response = FillResponse.Builder()
accounts.forEach { account ->
    val dataset = DatasetFactory.createDataset(
        context = context,
        account = account,
        usernameId = usernameId,
        passwordId = passwordId
    )
    response.addDataset(dataset)
}
return response.build()
```

## DatasetFactory

`/android/app/src/main/java/com/kiyo/app/autofill/response/DatasetFactory.kt` constructs a single `Dataset` from an `AutofillAccount`:

```kotlin
object DatasetFactory {
    fun createDataset(
        context: Context,
        account: AutofillRepository.AutofillAccount,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): Dataset
}
```

The factory:

1. Looks up the icon via `IconResourceMapper.resolve(account.domain, account.packageNames.firstOrNull())`.
2. Builds a `RemoteViews` presentation with the icon and account label (title or domain/package).
3. Populates the username field with `account.username`.
4. Populates the password field with `account.password`.
5. Sets a `SaveInfo` flag on the dataset so the system can offer to save on submit.

## SaveInfo lifecycle

`SaveInfo` is provided in the dataset per the Android Autofill API contract — it is **not** provided in `onSaveRequest`. Each dataset carries its own save info with `SAVE_DATA_TYPE_USERNAME | SAVE_DATA_TYPE_PASSWORD`.

## Source Anchors

- `FillResponseBuilder.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt`
- `DatasetFactory.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/response/DatasetFactory.kt`
- Layouts — `/android/app/src/main/res/layout/autofill_auth_item.xml`, `autofill_dataset_item.xml`, `autofill_save_item.xml`