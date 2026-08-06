package com.kiyo.app.autofill.response

import android.content.Context
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kiyo.app.R
import com.kiyo.app.autofill.icon.IconResourceMapper
import com.kiyo.app.autofill.repository.AutofillRepository

/**
 * Factory for creating Dataset objects from AutofillAccount.
 * Extracted from FillResponseBuilder to separate dataset creation logic.
 */
class DatasetFactory(private val context: Context) {

    private val TAG = "DatasetFactory"

    /**
     * Create a Dataset for a single account.
     */
    fun createDataset(
        account: AutofillRepository.AutofillAccount,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): Dataset? {
        val siteName = account.title ?: account.appName ?: account.packageNames.firstOrNull() ?: "Unknown Site"
        val domain = account.domain ?: account.packageNames.firstOrNull() ?: ""

        val presentation = RemoteViews(context.packageName, R.layout.autofill_dataset_item)
        presentation.setTextViewText(R.id.tv_site_name, siteName)
        presentation.setTextViewText(R.id.tv_domain, domain)
        presentation.setTextViewText(R.id.tv_username, account.username)

        // Set site icon based on priority: account icon -> website preset icon -> default icon
        val iconResId = IconResourceMapper.getSiteIconResource(account)
        presentation.setImageViewResource(R.id.iv_site_icon, iconResId)

        val datasetBuilder = Dataset.Builder(presentation)
        var hasValue = false
        usernameId?.let { id ->
            datasetBuilder.setValue(id, AutofillValue.forText(account.username))
            Log.d(TAG, "Set username value for id=$id: ${account.username}")
            hasValue = true
        }
        passwordId?.let { id ->
            datasetBuilder.setValue(id, AutofillValue.forText(account.password))
            Log.d(TAG, "Set password value for id=$id")
            hasValue = true
        }

        // Only create dataset if at least one value is set (username or password)
        if (hasValue) {
            return datasetBuilder.build()
        } else {
            Log.d(TAG, "Skipping dataset for account ${account.username}: no field IDs available")
            return null
        }
    }
}