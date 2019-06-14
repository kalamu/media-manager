
/*
 * This file is part of the kalamu/media-manager package.
 *
 * (c) ETIC Services
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import KalamuImage from './KalamuImage.js';
import Cropper from 'cropperjs/dist/cropper.min.js';

import Polyglot from 'node-polyglot';
import translations from './translations.js';

var polyglot = new Polyglot();

export default class KalamuMediaManager
{
    constructor(config)
    {
        let lang = config.lang||window.navigator.language.substr(0, 2);
        if(!lang || translations.translations[lang] === undefined){
            lang = 'en';
        }
        polyglot.extend(translations.translations[lang]);
        polyglot.locale(lang);


        this.dropZone = config.dropZone;
        this.dropZone.classList.add('kmm-dropZone');

        this.displayZone = config.displayZone;
        this.displayZone.classList.add('kmm-displayZone');

        this.infoZone = config.infoZone;
        this.infoZone.classList.add('kmm-infoZone');

        this.apiEntryPoint = config.apiEntryPoint;
        this.selectable = config.selectable||'none';
        if(-1 === ['none', 'single', 'multiple'].indexOf(this.selectable)){
            throw new Error("'selectable' attribute can only be : none, single or multiple");
        }

        // callableEvents
        this.onStart = config.onStart||(function(){});
        this.onSelectionChanged = config.onSelectionChanged||(function(){});

        this.images = [];

        this.showImageDetails = this.showImageDetails.bind(this);
        this.startEditMode = this.startEditMode.bind(this);
        this.deleteImage = this.deleteImage.bind(this);

        this.imageCrop = this.imageCrop.bind(this);
        this.imageFlipH = this.imageFlipH.bind(this);
        this.imageFlipV = this.imageFlipV.bind(this);
        this.imageRotate90L = this.imageRotate90L.bind(this);
        this.imageRotate90R = this.imageRotate90R.bind(this);
        this.imageSave = this.imageSave.bind(this);
        this.imageSaveAsCopy = this.imageSaveAsCopy.bind(this);
        this.imageCancel = this.imageCancel.bind(this);
        this.stopEdit = this.stopEdit.bind(this);

        this.dropZone.addEventListener('dragover', this.onDragover.bind(this));
        this.dropZone.addEventListener('drop', this.onDrop.bind(this));
        this.dropZone.querySelector('input').addEventListener('change', this.onAddByBrowser.bind(this));

        // Ecoute si une autre instance fait des modifications de fichiers
        window.addEventListener(this.apiEntryPoint, (function(e){
            if(e.detail !== this){
                var selection = this.getSelection();
                this.fetchList().then(() => {
                    this.setSelection(selection);
                })
            }
        }).bind(this));

        this.handleSelection();

        this.fetchList()
            .then((function(){
                return new Promise((function(resolve, reject){
                    this.onStart(this);
                    resolve();
                }).bind(this));
            }).bind(this)).then((function(){
            let notifier = (function(e){
                if(this.images.indexOf(e.detail) >= 0){
                    this.onSelectionChanged(this);
                }
            }).bind(this);

            document.addEventListener('kalamu-image.selected', notifier);
            document.addEventListener('kalamu-image.deselected', notifier);
        }).bind(this));
    }

    getImages()
    {
        return this.images;
    }

    handleSelection()
    {
        if(this.selectable === 'none'){
            return;
        }

        if(this.selectable === 'single'){
            document.addEventListener('kalamu-image.selected', (function(e){
               if(this.images.indexOf(e.detail) === -1){
                    return false;
               }
               for(let img of this.images){
                   if(img.isSelected() && img !== e.detail){
                       img.deselect();
                   }
               }
            }).bind(this));
        }
    }

    getSelection()
    {
        return this.images.filter(function(img){
            return img.isSelected();
        }).map(function(img){
            return img.config.identifier;
        })
    }

    setSelection(identifiers)
    {
        for(let img of this.images){
            if(identifiers.indexOf( img.config.identifier ) >= 0){
                img.select();
            }else{
                img.deselect();
            }
        }
    }

    onDragover(e){
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    onDrop(e){
        e.stopPropagation();
        e.preventDefault();

        this.addFiles(e.dataTransfer.files);
    }

    onAddByBrowser(e)
    {
        e.stopPropagation();
        e.preventDefault();

        this.addFiles(this.dropZone.querySelector('input').files);
        this.dropZone.querySelector('input').form.reset();
    }

    addFiles(list)
    {
        for (let file of list){
            if (file.type.match(/image.*/)) {
                KalamuImage.createFromInput(file).then((function(image){
                    let length = this.images.push( image );
                    image.setImageIndex( length-1 );
                    image.uploadTo(this.apiEntryPoint);
                    this.refreshList().then((function(){
                        if(this.images.length === 1 && this.selectable !== 'none'){
                            this.images[0].select();
                        }
                    }).bind(this));
                    window.dispatchEvent(new CustomEvent(this.apiEntryPoint, {detail: this}));
                }).bind(this));
            }
        }

        let parser = new DOMParser();
        let alert = parser.parseFromString('<div class="kalamu-notification text-success"><strong>'+polyglot.t("num_added", {smart_count: list.length})+' </strong></div>', 'text/xml');
        this.dropZone.append(alert.firstChild);
        setTimeout((function(){
           this.dropZone.querySelector('.kalamu-notification').remove();
         }).bind(this), 2000);

    }

    // Récupère la liste des images depuis l'API
    fetchList()
    {
        return new Promise((function(resolve, reject){
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.onload = (function(e) {
                if (e.target.readyState == 4 && e.target.status == 200){
                    this.images = [];
                    for(let image of JSON.parse(xmlHttp.responseText)){
                        this.images.push( new KalamuImage(image) );
                    }

                    this.refreshList().then(resolve());
                }
            }).bind(this);
            xmlHttp.open("GET", this.apiEntryPoint, true);
            xmlHttp.send(null);
        }).bind(this));
    }

    // Actualise le rendu de la liste
    refreshList()
    {
        return new Promise((function(resolve, reject){
            this.sortList();

            this.displayZone.innerHTML = '';
            for(let index in this.images){
                let image = this.images[index];

                image.setImageIndex(index);
                image.setSelectable( this.selectable !== 'none' );
                let element = image.display(this.displayZone);
                element.addEventListener('click', this.showImageDetails);
            }

            if(!this.images.length){
                this.displayZone.innerHTML = '<div class="kmm-empty-list"><strong>'+polyglot.t('no_files')+'</strong><br><span>'+polyglot.t('no_files_help')+'</span></div>';
            }
            resolve();
        }).bind(this));
    }

    sortList()
    {
        this.images.sort(function(a, b){
            return a.config.identifier > b.config.identifier;
        }).map(function(image, i){
            image.setImageIndex(i);
        });
    }

    showImageDetails(e)
    {
        if(e){
            e.stopPropagation();
            e.preventDefault();

            if(!e.target.hasAttribute('kalamu-img-index')){
                return;
            }
            this.currentImage = this.images[ e.target.getAttribute('kalamu-img-index') ];
        }

        this.infoZone.querySelector('img').setAttribute('src', this.currentImage.config.url);

        this.infoZone.querySelector('.img-metas').removeAttribute('hidden');
        this.infoZone.querySelector('.img-tools').setAttribute('hidden', true);

        this.infoZone.querySelector('.kmm-start-edit').addEventListener('click', this.startEditMode);
        this.infoZone.querySelector('.kmm-delete-image').addEventListener('click', this.deleteImage);

        this.infoZone.querySelector('.file-name .value').textContent = this.currentImage.config.name;
        this.infoZone.querySelector('.file-type .value').textContent = this.currentImage.config.type;
        let creationDate = new Date(this.currentImage.config.created_at*1000);
        this.infoZone.querySelector('.file-date .value').textContent = polyglot.t('date', {
            day: String("0"+creationDate.getDay()).slice(-2),
            month: String("0"+creationDate.getMonth()).slice(-2),
            year: creationDate.getFullYear()});
        this.infoZone.querySelector('.file-size .value').textContent = Math.floor(this.currentImage.config.size/1024)+'Ko';
        this.infoZone.querySelector('.file-dimensions .value').textContent = polyglot.t("dimensions_pixels", {
            width: this.currentImage.config.dimensions.width,
            height: this.currentImage.config.dimensions.height});

        $(this.infoZone).one('hide.bs.modal', this.onImageDetailsClose.bind(this));
        $(this.infoZone).modal('show');
    }

    startEditMode(e)
    {
        e.stopPropagation();
        e.preventDefault();

        this.infoZone.querySelector('.img-tools').removeAttribute('hidden');
        this.infoZone.querySelector('.img-metas').setAttribute('hidden', true);

        const image = this.infoZone.querySelector('.cropperImagecontainer img');
        this.cropper = new Cropper(image, {
            viewMode: 2,
            autoCrop: false,
            responsive: true,
            zoomOnWheel: false
        });

        this.infoZone.querySelector('.kmm-cropper-crop').addEventListener('click', this.imageCrop);
        this.infoZone.querySelector('.kmm-cropper-flip-h').addEventListener('click', this.imageFlipH);
        this.infoZone.querySelector('.kmm-cropper-flip-v').addEventListener('click', this.imageFlipV);
        this.infoZone.querySelector('.kmm-cropper-rotate-90-l').addEventListener('click', this.imageRotate90L);
        this.infoZone.querySelector('.kmm-cropper-rotate-90-r').addEventListener('click', this.imageRotate90R);
        this.infoZone.querySelector('.kmm-cropper-save').addEventListener('click', this.imageSave);
        this.infoZone.querySelector('.kmm-cropper-saveAsCopy').addEventListener('click', this.imageSaveAsCopy);
        this.infoZone.querySelector('.kmm-cropper-cancel').addEventListener('click', this.imageCancel);
    }

    deleteImage(e)
    {
        e.stopPropagation();
        e.preventDefault();

        if(this.currentImage.isSelected()){
            this.currentImage.deselect();
        }

        let xhr = new XMLHttpRequest();
        xhr.addEventListener('load', (function(e){
            this.images.splice( this.images.indexOf(this.currentImage), 1 );
            this.currentImage = null;
            $(this.infoZone).modal('hide');
            window.dispatchEvent(new CustomEvent(this.apiEntryPoint, {detail: this}));
            this.refreshList();
        }).bind(this));

        xhr.open('DELETE', this.apiEntryPoint+'/'+this.currentImage.config.identifier, true);
        xhr.send(null);
    }

    onImageDetailsClose()
    {
        this.infoZone.querySelector('.kmm-start-edit').removeEventListener('click', this.startEditMode);
        this.infoZone.querySelector('.kmm-delete-image').removeEventListener('click', this.deleteImage);

        if(this.cropper){
            this.stopEdit();
        }
    }

    stopEdit()
    {
        this.infoZone.querySelector('.kmm-cropper-crop').removeEventListener('click', this.imageCrop);
        this.infoZone.querySelector('.kmm-cropper-flip-h').removeEventListener('click', this.imageFlipH);
        this.infoZone.querySelector('.kmm-cropper-flip-v').removeEventListener('click', this.imageFlipV);
        this.infoZone.querySelector('.kmm-cropper-rotate-90-l').removeEventListener('click', this.imageRotate90L);
        this.infoZone.querySelector('.kmm-cropper-rotate-90-r').removeEventListener('click', this.imageRotate90R);
        this.infoZone.querySelector('.kmm-cropper-save').removeEventListener('click', this.imageSave);
        this.infoZone.querySelector('.kmm-cropper-saveAsCopy').removeEventListener('click', this.imageSaveAsCopy);
        this.infoZone.querySelector('.kmm-cropper-cancel').removeEventListener('click', this.imageCancel);
        this.cropper.destroy();
    }

    imageCrop()
    {
        this.cropper.crop();
    }

    imageFlipH()
    {
        this.cropper.scaleX( (this.cropper.getImageData().scaleX||1) * -1 );
    }

    imageFlipV()
    {
        this.cropper.scaleY( (this.cropper.getImageData().scaleY||1) * -1 );
    }

    imageRotate90L()
    {
        this.cropper.rotate(-90);
        this.centerImage();
    }

    imageRotate90R()
    {
        this.cropper.rotate(90);
        this.centerImage();
    }

    /**
     * Enregistre les modification en écrassant l'image originale
     */
    imageSave()
    {
        this.cropper.getCroppedCanvas({
            maxWidth: 4096,
            maxheight: 4096
        }).toBlob((function(blob){
            this.currentImage.updateFromBlob(blob);
            this.currentImage.uploadTo( this.apiEntryPoint );
            $(this.infoZone).modal('hide');
            window.dispatchEvent(new CustomEvent(this.apiEntryPoint, {detail: this}));
            this.refreshList();
        }).bind(this));
    }

    /**
     * Enregistre les modification dans une nouvelle copie (image originale préservée)
     */
    imageSaveAsCopy()
    {
        this.cropper.getCroppedCanvas({
            maxWidth: 4096,
            maxheight: 4096
        }).toBlob((function(blob){
            // clone Config
            let newConfig = JSON.parse(JSON.stringify(this.currentImage.config));
            newConfig.name = newConfig.name.replace(/^(.+)\.([^\.]+)$/, '$1-copie.$2');

            KalamuImage.createFromInput(blob, newConfig).then((function(image){
                this.images.push(image);
                image.uploadTo(this.apiEntryPoint);
                $(this.infoZone).modal('hide');
                window.dispatchEvent(new CustomEvent(this.apiEntryPoint, {detail: this}));
                this.refreshList();
            }).bind(this));
        }).bind(this));
    }

    imageCancel()
    {
        this.stopEdit();
        this.showImageDetails();
    }

    centerImage()
    {
        let containerData = this.cropper.getContainerData();
        let canvasData = this.cropper.getCanvasData();

        let widthRatio = containerData.width/canvasData.naturalWidth;
        let heightRatio = containerData.height/canvasData.naturalHeight;

        let ratio = 1;
        if(widthRatio < 1 || heightRatio < 1){
            ratio = Math.min(widthRatio, heightRatio);
        }

        this.cropper.zoomTo(ratio);
        containerData = this.cropper.getContainerData();
        canvasData = this.cropper.getCanvasData();
        this.cropper.moveTo( (containerData.width - canvasData.width) / 2, (containerData.height - canvasData.height) / 2 );
    }
}


