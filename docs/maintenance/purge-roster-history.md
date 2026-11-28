# Purging the committed class roster from git history

**Who runs this:** the repository owner, after agreeing on a time with everyone who has a clone.
**Why:** `supabase/bsit241_students.sql` held real students' names, student numbers and APC emails. It is no longer tracked (`supabase/*_students.sql` is git-ignored), but every earlier commit still contains it, and so does every existing clone and fork.

Rewriting history changes every commit hash from the first commit that added the file. Open pull requests and local branches need rebasing or re-creating afterwards.

## 1. Before you start
- Merge or close open pull requests where possible, and tell collaborators to push their work and stop committing.
- Make a backup mirror: `git clone --mirror https://github.com/<owner>/Rizlife-QuestCard.git backup.git`
- Install [git-filter-repo](https://github.com/newren/git-filter-repo) (`pip install git-filter-repo`).

## 2. Rewrite
```bash
git clone --mirror https://github.com/<owner>/Rizlife-QuestCard.git purge.git
cd purge.git
git filter-repo --invert-paths --path supabase/bsit241_students.sql
# Check that the file is gone from every commit (should print nothing):
git log --all --oneline -- supabase/bsit241_students.sql
```
If other roster files were ever committed, add one more `--path <file>` for each.

## 3. Publish
```bash
git push --force --mirror
```
Branch protection on `main` may have to be relaxed temporarily to allow the force-push.

## 4. Afterwards
- **Collaborators:** re-clone, or run `git fetch` and then `git reset --hard origin/<branch>` on each branch. Don't push old branches back, because that would bring the file back.
- **GitHub caches:** old commits stay reachable by hash through pull request references and caches. Ask GitHub Support to remove cached views and dereference the old commits ("Removing sensitive data from a repository" in GitHub Docs), and list the affected PRs.
- **Forks:** forks keep their own copies. Ask fork owners to delete or re-fork.
- **If the repository was ever public,** treat the data as disclosed. Tell the course instructor so they can decide on notifying the affected students, in line with APC's data-privacy process.
