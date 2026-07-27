## 🧪 Debugging Skipped Transformer Tests

Welcome! This guide will walk you through the process of solving skipped transformer test cases.

---

### ✅ Setup Instructions

1. **Clear your working directory**

2. **Checkout the main branch**:

   ```bash
   git checkout main
   git pull origin main
   ```

3. **Create a new branch from \*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*\*`main`**:
   *⚠️ Do not commit directly to **************`main`**************.*

   ```bash
   git checkout -b fix/<your-branch-name>
   ```

4. **Install dependencies and build the project**:

   ```bash
   pnpm
   pnpm build
   ```

5. **Navigate to the transform package and run tests**:

   ```bash
   cd packages/transform
   pnpm test
   ```

---

### 🔍 Where to Find Issues

Skipped tests (i.e. known transformer issues) are tracked in:

```
packages/transform/test-utils/skip-tests/transformer-errors.ts
```

Each entry looks like this:

```ts
[16, 17, "pretty/misc-5.sql", "16-17 transformer fails WITH clause TypeCast prefix issue: transformer adds pg_catalog prefix to JSON types when expected output has none"]
```

* `16, 17` refers to Postgres versions (previous->next) where this issue occurs.
* `pretty/misc-5.sql` is the test case.
* The last string is a human-readable explanation of the problem.

You can run an individual test like this:

```bash
pnpm test __tests__/kitchen-sink/16-17/pretty-misc.test.ts
```

---

### 🛠 Fixing the Test

1. Reproduce the failure with the specific test file above.
2. Once fixed, **comment out** the corresponding line in `transformer-errors.ts`.
3. Re-run the test to confirm it now passes:

```bash
pnpm test __tests__/kitchen-sink/16-17/pretty-misc.test.ts
```

Then, commit your fix and open a pull request.

---

### 🧾 Test Fixture Naming Convention

Test files like:

```
__tests__/kitchen-sink/16-17/pretty/misc-6.sql
```

Follow a specific naming pattern:

* `pretty/` is the folder of test fixture dir (e.g. pretty-printing).
* `misc-6.sql` means it's the **6th SQL statement** from the original `misc.sql` test file.
* \_\_fixtures\_\_/kitchen-sink/ is where the original sql lives, if you need to see it, in this case \_\_fixtures\_\_/kitchen-sink/pretty is the folder, and \_\_fixtures\_\_/kitchen-sink/pretty/misc.sql is the file

#### Why this format?

We split multi-statement fixture files into **line-by-line test cases** to:

* Improve test isolation and debugging clarity
* Enable precise diffs
* Optimize performance by bundling all SQL files into a **single JSON blob** during test runs

---

Ready to contribute? Pick an issue from `transformer-errors.ts`, debug, and push a clean fix on your branch!

Let’s squash these transformer bugs one at a time 💥
