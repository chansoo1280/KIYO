package com.kiyo.app.autofill;

import android.content.Context;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.List;
import static org.junit.Assert.*;

/**
 * Unit tests for AutofillRepository SQLite operations
 * Tests save, read, and delete functionality
 */
@RunWith(AndroidJUnit4.class)
public class AutofillRepositoryTest {

    private AutofillRepository repository;
    private Context context;

    @Before
    public void setUp() {
        context = ApplicationProvider.getApplicationContext();
        repository = new AutofillRepository(context);
    }

    @After
    public void tearDown() {
        if (repository != null) {
            repository.close();
        }
    }

    @Test
    public void testSaveAndReadAccount() {
        // Create a test account
        AutofillRepository.AutofillAccount account = new AutofillRepository.AutofillAccount(
            -1L, // id (auto-generated)
            "testuser@example.com",
            "testpassword123",
            "Test Account",
            "com.example.app",
            "example.com",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            false
        );

        // Save the account
        long id = repository.upsertAccount(account);
        assertTrue("Account should be saved with valid ID", id > 0);

        // Read the account by package name
        List<AutofillRepository.AutofillAccount> accounts = repository.findByPackageName("com.example.app");
        assertNotNull("Accounts list should not be null", accounts);
        assertEquals("Should have exactly one account", 1, accounts.size());

        AutofillRepository.AutofillAccount savedAccount = accounts.get(0);
        assertEquals("Username should match", "testuser@example.com", savedAccount.username);
        assertEquals("Password should match", "testpassword123", savedAccount.password);
        assertEquals("Title should match", "Test Account", savedAccount.title);
        assertEquals("Package name should match", "com.example.app", savedAccount.packageName);
        assertEquals("Domain should match", "example.com", savedAccount.domain);
        assertFalse("Favorite should be false", savedAccount.favorite);
        assertTrue("ID should be set", savedAccount.id > 0);
    }

    @Test
    public void testUpdateAccount() {
        // Create and save initial account
        AutofillRepository.AutofillAccount account = new AutofillRepository.AutofillAccount(
            -1L,
            "user@example.com",
            "oldpassword",
            "Original Title",
            "com.example.app",
            "example.com",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            false
        );

        long id = repository.upsertAccount(account);
        assertTrue("Initial save should succeed", id > 0);

        // Update the account
        AutofillRepository.AutofillAccount updatedAccount = new AutofillRepository.AutofillAccount(
            id,
            "user@example.com",
            "newpassword456",
            "Updated Title",
            "com.example.app",
            "example.com",
            account.createdAt,
            System.currentTimeMillis(),
            true
        );

        long updatedId = repository.upsertAccount(updatedAccount);
        assertEquals("Updated ID should match original", id, updatedId);

        // Verify the update
        List<AutofillRepository.AutofillAccount> accounts = repository.findByPackageName("com.example.app");
        assertEquals("Should still have one account", 1, accounts.size());

        AutofillRepository.AutofillAccount saved = accounts.get(0);
        assertEquals("Password should be updated", "newpassword456", saved.password);
        assertEquals("Title should be updated", "Updated Title", saved.title);
        assertTrue("Favorite should be updated", saved.favorite);
    }

    @Test
    public void testDeleteAccount() {
        // Create and save an account
        AutofillRepository.AutofillAccount account = new AutofillRepository.AutofillAccount(
            -1L,
            "deleteuser@example.com",
            "deletepassword",
            "To Be Deleted",
            "com.example.delete",
            "delete.example.com",
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            false
        );

        long id = repository.upsertAccount(account);
        assertTrue("Save should succeed", id > 0);

        // Verify it exists
        List<AutofillRepository.AutofillAccount> accounts = repository.findByPackageName("com.example.delete");
        assertEquals("Should have one account before delete", 1, accounts.size());

        // Delete the account
        int deletedCount = repository.deleteAccount(id);
        assertEquals("Should delete exactly one account", 1, deletedCount);

        // Verify it's deleted
        accounts = repository.findByPackageName("com.example.delete");
        assertEquals("Should have zero accounts after delete", 0, accounts.size());
    }

    @Test
    public void testFindByPackageName() {
        // Save multiple accounts for different packages
        AutofillRepository.AutofillAccount account1 = new AutofillRepository.AutofillAccount(
            -1L, "user1@a.com", "pass1", "Account 1", "com.app.a", "a.com",
            System.currentTimeMillis(), System.currentTimeMillis(), false
        );
        AutofillRepository.AutofillAccount account2 = new AutofillRepository.AutofillAccount(
            -1L, "user2@b.com", "pass2", "Account 2", "com.app.b", "b.com",
            System.currentTimeMillis(), System.currentTimeMillis(), false
        );
        AutofillRepository.AutofillAccount account3 = new AutofillRepository.AutofillAccount(
            -1L, "user3@a.com", "pass3", "Account 3", "com.app.a", "a.com",
            System.currentTimeMillis(), System.currentTimeMillis(), true
        );

        repository.upsertAccount(account1);
        repository.upsertAccount(account2);
        repository.upsertAccount(account3);

        // Find by package name
        List<AutofillRepository.AutofillAccount> accountsA = repository.findByPackageName("com.app.a");
        assertEquals("Should find 2 accounts for com.app.a", 2, accountsA.size());

        List<AutofillRepository.AutofillAccount> accountsB = repository.findByPackageName("com.app.b");
        assertEquals("Should find 1 account for com.app.b", 1, accountsB.size());

        List<AutofillRepository.AutofillAccount> accountsC = repository.findByPackageName("com.app.c");
        assertEquals("Should find 0 accounts for non-existent package", 0, accountsC.size());
    }

    @Test
    public void testFindByDomain() {
        // Save accounts with different domains
        AutofillRepository.AutofillAccount account1 = new AutofillRepository.AutofillAccount(
            -1L, "user1@site.com", "pass1", "Site 1", "com.app.site1", "site.com",
            System.currentTimeMillis(), System.currentTimeMillis(), false
        );
        AutofillRepository.AutofillAccount account2 = new AutofillRepository.AutofillAccount(
            -1L, "user2@other.com", "pass2", "Site 2", "com.app.site2", "other.com",
            System.currentTimeMillis(), System.currentTimeMillis(), false
        );

        repository.upsertAccount(account1);
        repository.upsertAccount(account2);

        // Find by domain
        List<AutofillRepository.AutofillAccount> siteAccounts = repository.findByDomain("site.com");
        assertEquals("Should find 1 account for site.com", 1, siteAccounts.size());
        assertEquals("Username should match", "user1@site.com", siteAccounts.get(0).username);

        List<AutofillRepository.AutofillAccount> otherAccounts = repository.findByDomain("other.com");
        assertEquals("Should find 1 account for other.com", 1, otherAccounts.size());
    }

    @Test
    public void testGetAllAccounts() {
        // Clear any existing data by using unique package names
        AutofillRepository.AutofillAccount account1 = new AutofillRepository.AutofillAccount(
            -1L, "all1@test.com", "pass1", "All 1", "com.test.all1", "test.com",
            System.currentTimeMillis(), System.currentTimeMillis(), false
        );
        AutofillRepository.AutofillAccount account2 = new AutofillRepository.AutofillAccount(
            -1L, "all2@test.com", "pass2", "All 2", "com.test.all2", "test.com",
            System.currentTimeMillis(), System.currentTimeMillis(), true
        );

        repository.upsertAccount(account1);
        repository.upsertAccount(account2);

        List<AutofillRepository.AutofillAccount> allAccounts = repository.getAllAccounts();
        assertNotNull("All accounts list should not be null", allAccounts);
        assertTrue("Should have at least 2 accounts", allAccounts.size() >= 2);
    }

    @Test
    public void testSyncAccountsFromReact() {
        // Test sync functionality with JSON array (React format with fields array)
        String jsonAccounts = "["
            + "{\"title\":\"Sync 1\",\"favorite\":false,\"fields\":[{\"label\":\"username\",\"type\":\"email\",\"value\":\"sync1@test.com\"},{\"label\":\"password\",\"type\":\"password\",\"value\":\"syncpass1\"},{\"label\":\"package\",\"type\":\"text\",\"value\":\"com.sync.test1\"},{\"label\":\"domain\",\"type\":\"text\",\"value\":\"sync.test.com\"}]},"
            + "{\"title\":\"Sync 2\",\"favorite\":true,\"fields\":[{\"label\":\"username\",\"type\":\"email\",\"value\":\"sync2@test.com\"},{\"label\":\"password\",\"type\":\"password\",\"value\":\"syncpass2\"},{\"label\":\"package\",\"type\":\"text\",\"value\":\"com.sync.test2\"},{\"label\":\"domain\",\"type\":\"text\",\"value\":\"sync.test.com\"}]}"
            + "]";

        android.util.Pair<Integer, Integer> result = repository.syncAccountsFromReact(jsonAccounts);
        assertNotNull("Sync result should not be null", result);
        assertEquals("Should insert 2 accounts", 2, (int) result.first);
        assertEquals("Should update 0 accounts", 0, (int) result.second);

        // Verify accounts were saved
        List<AutofillRepository.AutofillAccount> accounts1 = repository.findByPackageName("com.sync.test1");
        assertEquals("Should find first synced account", 1, accounts1.size());
        assertEquals("Username should match", "sync1@test.com", accounts1.get(0).username);

        List<AutofillRepository.AutofillAccount> accounts2 = repository.findByPackageName("com.sync.test2");
        assertEquals("Should find second synced account", 1, accounts2.size());
        assertTrue("Second account should be favorite", accounts2.get(0).favorite);
    }
}