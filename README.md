# Report for Assignment 1

## Project chosen

Name: **Excalidraw editor**

URL: https://github.com/excalidraw/excalidraw

Number of lines of code and the tool used to count it: **393,216** - counted with **Lizard**

Programming language: **TypeScript**

> *note: The main language core can be seen as either TypeScript (393 KLOC) or JavaScript (5,440 KLOC). We decided to highlight TypeScript, as the unit tests are written in a TypeScript React (.tsx) dialect.*

## Coverage measurement

### Existing tool

The tool for unit testing within the repository is **vitest**. A coverage submodule was helpfully provided as part of the existing suite, and could be ran using the following command:

```bash
yarn test:coverage
```

Which generates an **Istanbul.js** report of coverage for the application.

For more targeted testing, the same command was used, but with a glob as the third argument:

```bash
yarn test:coverage /path/to/tests/*
```

The following is the outcome of running the existing tool on an unchanged version of excalibur cloned from https://github.com/excalidraw/excalidraw/commit/22b39277f5f4a6b125e170ab14238b084719cb2d, or the most recent commit at time of writing.

![Image](istanbul_main.png "Istanbul")

### Your own coverage tool

Team member name: Kacper Domagała

#### Function 1: restoreLibraryItems

<table>
  <tr>
    <td><img src="./readme-assets/Before-coverage-restore.png" alt="Pre-coverage restore" title="Pre-coverage restore" width="300"/>
    <div align="center">Pre-coverage restore</div>
    </td>
    <td><img src="./readme-assets/After-coverage-restore.png" alt="Post-coverage restore" title="Post-coverage restore" width="300"/>
    <div align="center">Post-coverage restore</div>
    </td>
  </tr>
</table>

#### Tool results 
<div align="center">
  <img src="./readme-assets/Coverage-result-restore.png" alt="Result-coverage restore" title="Pre-coverage restore" width="300" />
</div>



#### Function 2: shouldDiscardRemoteElement

<table>
  <tr>
    <td><img src="./readme-assets/Before-coverage-reconcile.png" alt="Pre-coverage restore" title="Pre-coverage restore" width="300"/>
    <div align="center">Pre-coverage reconcile</div>
    </td>
    <td><img src="./readme-assets/After-coverage-reconcile.png" alt="Post-coverage restore" title="Post-coverage restore" width="300"/>
    <div align="center">Post-coverage reconcile</div>
    </td>
  </tr>
</table>

#### Tool results 
<div align="center">
  <img src="./readme-assets/Coverage-result-reconcile.png" alt="Pre-coverage restore" title="Result-coverage reconcile" width="300" />
</div>

## Coverage improvement

### Individual tests

<The following is supposed to be repeated for each group member>

<Group member name>

<Test 1>

<Show a patch (diff) or a link to a commit made in your forked repository that shows the new/enhanced test>

<Provide a screenshot of the old coverage results (the same as you already showed above)>

<Provide a screenshot of the new coverage results>

<State the coverage improvement with a number and elaborate on why the coverage is improved>

<Test 2>

<Provide the same kind of information provided for Test 1>

### Overall

Old coverage results:

![Image](istanbul_main.png "Istanbul")

New coverage results:

<Provide a screenshot of the new coverage results by running the existing tool using all test modifications made by the group>

## Statement of individual contributions

<Write what each group member did>