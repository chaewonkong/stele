export namespace main {
	
	export class Note {
	    id: number;
	    title: string;
	    body: string;
	    pinned: boolean;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.body = source["body"];
	        this.pinned = source["pinned"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class NoteSummary {
	    id: number;
	    title: string;
	    preview: string;
	    pinned: boolean;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new NoteSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.preview = source["preview"];
	        this.pinned = source["pinned"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

