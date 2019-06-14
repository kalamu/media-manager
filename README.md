# Kalamu / Media Manager

This library is a JavaScript media manager based on top of a RESTFull API.
The library include only the client side library.

The goal is to provide a simple interface for :

* consulting medias
* uploadind/downloading files
* making simple changes on medias
* selecting files (in a form context)

__For the moment, the library only work for images, but we plan to manage more
types of files shortly__


# KalamuMediaManager

## Constructor

```js
var manager = new KalamuMediaManager(config);
```

Config is a object with the following properties.

| Parameter            | Required ? | Description                                                                                             |
|----------------------|:----------:|---------------------------------------------------------------------------------------------------------|
| `lang`               |  optional  | Define the interface language. If not set, `navigator.language` is used. Accepted values are : en, fr   |
| `dropZone`           |  required  | DOM Element to add files (by drag'n drop or file input)                                                 |
| `displayZone`        |  required  | DOM Element to display the file list                                                                    |
| `infoZone`           |  required  | DOM Element that must be a bootstrap modal to display file informations                                 |
| `apiEntryPoint`      |  required  | URL address of the RESTfull API                                                                         |
| `selectable`         |  optional  | Define if the files can be selected. Accepted values are : none, single, multiple                       |
| `onStart`            |  optional  | Function triggered at startup, once the file list has been fetched from the API                         |
| `onSelectionChanged` |  optional  | Function triggered when the user change the file selection                                              |



## Methods

### getImages()

Return the list of image objects that are on the manager.

Exemple :

``` js
console.log(manager.getImages());
// > Array(4) [ {...}, {...}, {...}, {...} ]

// get the uniq identifier of an image
console.log(manager.getImages()[0].config.identifier);
// > "0be916c4219e1a26c..."
```


### getSelection()

Return an array containing the identifier of each image selected.

Exemple :

``` js
console.log(manager.getSelection());
// > Array(2) [ "0be916c4219e1a26c...", "15b8669705ab106b00bfc..." ]
```


### setSelection(identifiers)

This method allow to set which files are selected.

Exemple :

``` js
console.log(manager.getSelection());
// > Array(2) [ "0be916c4219e1a26c...", "15b8669705ab106b00bfc..." ]

manager.setSelection(["0be916c4219e1a26c..."]); // change the selection

console.log(manager.getSelection());
// > Array(1) [ "0be916c4219e1a26c..." ]
```

