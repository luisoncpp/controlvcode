* Prefer variables with descriptive names instead of comments.

* Do not use magic numbers.

* Do not make functions with more than 3 parameters.

* When calling a function with a hardcoded `true` or `false` argument, use comments to simulated named parameters e.g. `myFunction(/*enabled=*/true)`

* Prefer return-early (`return` or `continue`) instead of nesting blocks.

* Do not make files longer than 200 lines.

* Do not make functions longer than 30 lines.

* When hardcoding a callback, make sure to specify what the callback does; when hardcoding a parameter after a callback, simulate named parameters using comments(because the meaning of the paramter is likely getting lost). e.g.

    **BAD**
    ```
    setTimeout(() => {
        ...
    }, 5000);
    ```

    **GOOD**
    ```
    setTimeout(/*refresh*/ () => {
        ...
    }, /*delayInMs=*/5000);
    ```

    This applies to hooks as well(specially to hooks).


# Workflow

* First read all the documentation that may be relevant for the given task.

* After reading it, perform the task.

* Run tests with `npm run test` after any meaningful change.

# Deep Modules

* To avoid unexpected side effects, this project uses deep modules: each one consists of possibly multiple implementation files with a thin public interface. The pieces of the deep module shouldn't be imported dirctly by the rest of the project, only the public interface.

* The folder structure gives clues about which ones are the deep modules:

   * if one folder is named "Private" it means is deep module implementation and only one file is allowed to reference its content.
   
   * if one folder has an `index.ts` inside, that means that it's a deep module and `indext.ts` is its public interface.

* It's possible to have deep modules inside deep modules (if a deep module B is inside a deep module A, then anything inside A can import only the public interface of B, and nothing outside A can import anything from B(not even the public interface))

# Implementing new features

* First suggest a plan, and ask the user if proceed with the implementation.

* This developer prefers to use standard classes(possibly with event emitters) over hooks, because hooks tend to behave like side effects. So prioritize writting a standard class over a function with lots of hooks.

* If hooks are necessary or have a considerable advantage, consider to put most of the implementation in a class and use a hook as an adapter.

* If multiple files are going to be needed, consider creating a deep module.

* After implementing a new feature, documenting the architecture is mandatory. Be concise in the documentation, maximizing the information / token ratio (as it will probably be read by future agents and we don't like to waste their context)

* Update `docs/architecture/README.md` to include the new feature.