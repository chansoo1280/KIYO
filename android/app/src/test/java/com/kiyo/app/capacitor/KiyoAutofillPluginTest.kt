package com.kiyo.app.capacitor

import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class KiyoAutofillPluginTest {

    @Test
    fun `plugin initializes without crashing`() = runTest {
        // Given
        val plugin = KiyoAutofillPlugin()

        // When
        plugin.load()

        // Then - should not crash
        assertNotNull(plugin)
    }

    @Test
    fun `plugin can be instantiated`() = runTest {
        // Given/When
        val plugin = KiyoAutofillPlugin()

        // Then
        assertNotNull(plugin)
    }
}