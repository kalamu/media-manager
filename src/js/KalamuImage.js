
/*
 * This file is part of the kalamu/media-manager package.
 *
 * (c) ETIC Services
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import CryptoJS from 'crypto-js/crypto-js';

var arrayBufferToWordArray = function (ab) {
    var i8a = new Uint8Array(ab);
    var a = [];
    for (var i = 0; i < i8a.length; i += 4) {
        a.push(i8a[i] << 24 | i8a[i + 1] << 16 | i8a[i + 2] << 8 | i8a[i + 3]);
    }
    return CryptoJS.lib.WordArray.create(a, i8a.length);
}

var getFileSha1 = function(file)
{
    return new Promise(function(resolve, reject){

        let reader = new FileReader();
        reader.onloadend = function(e){
            resolve( CryptoJS.SHA1(arrayBufferToWordArray(e.target.result)).toString() );
        }
        reader.readAsArrayBuffer(file);

    });
}

export default class KalamuImage
{

    constructor(config)
    {
        this.config = config;

        this.onSelectorClick = this.onSelectorClick.bind(this);

        this.model = '<div class="kalamu-thumbnail">\n\
                <a class="kalamu-checker"><i class="fa fa-check text-success"></i></a>\n\
                <div class="progress" hidden="true"><div class="progress-bar bg-success" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div></div>\n\
            </div>';
    }

    static createFromInput(file, config = null)
    {
        if(config === null){
            config = {};
        }

        config.name = config.name || file.name;
        config.type = config.type || file.type;
        config.input = file;
        config.new = true;

        let sha1Compute = new Promise((resolve, reject) => {
            getFileSha1(file).then(function(hash){
                resolve(hash);
            });
        });

        let readImage = new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = function(e2) {
                resolve(e2.target.result);
            };
            reader.readAsDataURL(file);
        });

        return Promise.all([config, sha1Compute, readImage]).then(function(values){
            let config = values[0];
            config.identifier = values[1];
            config.url = values[2];
            config.thumbnail_url = values[2];
            return new KalamuImage(config);
        });
    }

    updateFromBlob(file)
    {
        this.config.type = file.type;
        this.config.input = file;
    }

    setSelectable(selectable)
    {
        this.config.selectable = selectable;

        if(this.element){
            if(selectable){
                this.element.querySelector('.kalamu-checker').addEventListener('click', this.onSelectorClick);
            }else{
                this.element.querySelector('.kalamu-checker').removeEventListener('click', this.onSelectorClick);
            }
        }
    }

    display(parent)
    {
        if(this.element === undefined){
            let div = document.createElement('div');
            div.innerHTML = this.model.trim();
            this.element = div.firstChild;

            if(this.config.selectable){
                this.element.querySelector('.kalamu-checker').addEventListener('click', this.onSelectorClick);
            }
        }

        parent.appendChild( this.element );
        this.refresh();
        return this.element;
    }

    refresh()
    {
        if(this.element === undefined){
            return;
        }

        if(this.config.selectable){
            this.element.classList.add('selectable');
        }else{
            this.element.classList.remove('selectable');
        }
        this.element.setAttribute('kalamu-img-index', this.config.index);
        this.element.style['background-image'] = 'url('+this.config.thumbnail_url+')';

        let bar = this.element.getElementsByClassName('progress')[0];
        if(this.config.uploading !== undefined){
            bar.removeAttribute('hidden');
            bar.children[0].setAttribute('style', 'width: '+this.config.uploading+'%');
            bar.children[0].setAttribute('aria-valuenow', this.config.uploading);
        }else{
            bar.setAttribute('hidden', true);
        }
    }

    setImageIndex(index)
    {
        this.config.index = index;
        if(this.element){
            this.element.setAttribute('kalamu-img-index', this.config.index);
        }
    }

    onSelectorClick(e)
    {
        e.stopPropagation();
        e.preventDefault();

        if(this.isSelected()){
            this.deselect();
        }else{
            this.select();
        }
    }

    isSelected()
    {
        return this.element.classList.contains('selected');
    }

    select()
    {
        this.element.classList.add('selected');
        document.dispatchEvent( new CustomEvent('kalamu-image.selected', {detail: this}) );
    }

    deselect()
    {
        this.element.classList.remove('selected');
        document.dispatchEvent( new CustomEvent('kalamu-image.deselected', {detail: this}) );
    }

    uploadTo(apiEntryPoint)
    {
        if(this.config.input === undefined) {
            return;
        }
        if(this.config.input instanceof Blob){
            this.config.input = new File([this.config.input], this.config.name, {type: this.config.type});
        }

        let xhr = new XMLHttpRequest();
        xhr.addEventListener('progress', (function(e) {
            if (e.lengthComputable) {
                this.config.uploading = e.loaded / e.total * 100;
                this.refresh();
            }
        }).bind(this));
        xhr.addEventListener('load', (function(e){
            delete this.config.uploading;
            this.config.new = false;
            let newConfig = JSON.parse(e.target.responseText);
            for(let prop of ['identifier', 'name', 'type', 'created_at', 'size', 'url', 'thumbnail_url', 'dimensions']){
                this.config[prop] = newConfig[prop];
            }
            this.refresh();
        }).bind(this));

        if(this.config.new||false){ // POST
            let formData = new FormData();
            formData.append("image", this.config.input);

            xhr.open('POST', apiEntryPoint+'/'+this.config.identifier, true);
            xhr.send(formData);
        }else{ // PUT
            xhr.open('PUT', apiEntryPoint+'/'+this.config.identifier, true);
            xhr.send(this.config.input);
        }


    }

}
