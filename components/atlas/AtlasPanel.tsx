"use client";

import {
    useEffect,
    useRef,
    useState,
    type DragEvent,
} from "react";

import { createClient } from "@/lib/supabase/client";

import type {
    AtlasCollection,
    AtlasDraftPin,
    AtlasPin,
    AtlasPinMoment,
    AtlasPerson,
    AtlasTimeState,
} from "@/types/atlas";

/* =========================================
   MEDIA
========================================= */

type AtlasMedia = {
    id: string;
    pin_id: string;
    folder_id: string | null;
    moment_id: string | null;

    name: string;
    original_name: string | null;

    source_type:
    | "upload"
    | "link";

    provider:
    | "bunny"
    | "youtube"
    | "external";

    storage_path: string | null;

    media_type:
    | "image"
    | "audio"
    | "video"
    | "pdf"
    | "file"
    | "youtube"
    | "youtube_playlist"
    | "website";

    mime_type: string | null;

    file_size:
    | number
    | string
    | null;

    external_url: string | null;
    external_id: string | null;
    thumbnail_url: string | null;

    metadata:
    Record<string, unknown>;

    created_at: string;
    updated_at: string;

    url: string;
};

/* =========================================
   FOLDER
========================================= */

type AtlasMediaFolder = {
    id: string;
    pin_id: string;
    moment_id: string | null;
    name: string;
    created_at: string;
    updated_at: string;
};

/* =========================================
   PEOPLE
========================================= */

type AtlasPersonPinRelationship = {
    id: string;
    person_id: string;
    pin_id: string;
    moment_id: string | null;

    role_in_context: string | null;
    notes: string | null;

    created_at: string;

    person: AtlasPerson;
};

type AtlasPersonFormMode =
    | "new"
    | "existing"
    | "edit";

/* =========================================
   TASKS
========================================= */

type AtlasPinTask = {
    id: string;
    pin_id: string;
    moment_id: string | null;

    title: string;

    is_complete: boolean;
    completed_at: string | null;

    created_at: string;
    updated_at: string;
};


type AtlasMomentFormType =
    | "date"
    | "datetime"
    | "range";

type AtlasInitialMomentInput = {
    title: string | null;
    momentType: AtlasMomentFormType;
    startAt: string;
    endAt: string | null;
    timezone: string;
    notes: string | null;
};

/* =========================================
   PROPS
========================================= */

type AtlasPanelProps = {
    draftPin:
    AtlasDraftPin | null;

    selectedPin:
    AtlasPin | null;

    defaultTimeState:
    AtlasTimeState;

    collections:
    AtlasCollection[];

    onCancel: () => void;

    onSave: (
        pin: AtlasPin,
        initialMoment?: AtlasInitialMomentInput | null
    ) => Promise<AtlasPin | void> | AtlasPin | void;

    onUpdate: (
        pin: AtlasPin
    ) => Promise<void> | void;

    onDelete: (
        pinId: string
    ) => Promise<void> | void;

    isRepositioningPin: boolean;

    repositionPinPosition:
    AtlasDraftPin | null;

    onStartRepositionPin:
    () => void;

    onCancelRepositionPin:
    () => void;

    onSaveRepositionPin:
    () => Promise<void> | void;

    onPinCoverChange: (
        pinId: string,
        coverMediaId: string | null,
        coverImageUrl?: string | null
    ) => Promise<void> | void;

    onMomentsChange: (
        pinId: string,
        moments: AtlasPinMoment[]
    ) => void;
};

/* =========================================
   FILE SIZE
========================================= */

function formatFileSize(
    size:
        | number
        | string
        | null
) {
    if (
        size === null ||
        size === undefined
    ) {
        return "";
    }

    const bytes =
        Number(size);

    if (
        Number.isNaN(bytes)
    ) {
        return "";
    }

    if (
        bytes < 1024
    ) {
        return `${bytes} B`;
    }

    if (
        bytes <
        1024 * 1024
    ) {
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    if (
        bytes <
        1024 *
        1024 *
        1024
    ) {
        return `${(
            bytes /
            (1024 * 1024)
        ).toFixed(1)} MB`;
    }

    return `${(
        bytes /
        (
            1024 *
            1024 *
            1024
        )
    ).toFixed(1)} GB`;
}

/* =========================================
   DROPPED URL DETECTION
========================================= */

function getDroppedUrl(
    dataTransfer: DataTransfer
) {
    const uriList =
        dataTransfer.getData(
            "text/uri-list"
        );

    if (uriList) {
        const uri =
            uriList
                .split(/\r?\n/)
                .map(
                    (value) =>
                        value.trim()
                )
                .find(
                    (value) =>
                        value &&
                        !value.startsWith("#")
                );

        if (
            uri &&
            /^https?:\/\//i.test(
                uri
            )
        ) {
            return uri;
        }
    }

    const plainText =
        dataTransfer
            .getData(
                "text/plain"
            )
            .trim();

    if (plainText) {
        const match =
            plainText.match(
                /https?:\/\/[^\s\])>"']+/i
            );

        if (
            match?.[0]
        ) {
            return match[0];
        }
    }

    const html =
        dataTransfer.getData(
            "text/html"
        );

    if (html) {
        try {
            const parsed =
                new DOMParser()
                    .parseFromString(
                        html,
                        "text/html"
                    );

            const image =
                parsed.querySelector(
                    "img[src]"
                );

            const imageSrc =
                image?.getAttribute(
                    "src"
                );

            if (
                imageSrc &&
                /^https?:\/\//i.test(
                    imageSrc
                )
            ) {
                return imageSrc;
            }

            const anchor =
                parsed.querySelector(
                    "a[href]"
                );

            const href =
                anchor?.getAttribute(
                    "href"
                );

            if (
                href &&
                /^https?:\/\//i.test(
                    href
                )
            ) {
                return href;
            }
        } catch {
            return null;
        }
    }

    return null;
}


/* =========================================
   MOMENT HELPERS
========================================= */

function getBrowserTimezone() {
    try {
        return (
            Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone ||
            "UTC"
        );
    } catch {
        return "UTC";
    }
}

function localDateToIso(
    value: string
) {
    if (!value) {
        return "";
    }

    /*
      Noon avoids accidental previous-day
      display when a date-only value is
      converted through UTC.
    */

    return new Date(
        `${value}T12:00:00`
    ).toISOString();
}

function localDateTimeToIso(
    value: string
) {
    if (!value) {
        return "";
    }

    return new Date(
        value
    ).toISOString();
}

function isoToDateInput(
    value: string
) {
    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function isoToDateTimeInput(
    value: string
) {
    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    const hours =
        String(
            date.getHours()
        ).padStart(2, "0");

    const minutes =
        String(
            date.getMinutes()
        ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatMomentChip(
    moment: AtlasPinMoment
) {
    const date =
        new Date(
            moment.start_at
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "DATE";
    }

    return new Intl.DateTimeFormat(
        "en-US",
        {
            month: "short",
            day: "numeric",
        }
    )
        .format(date)
        .toUpperCase();
}

function formatMomentLongDate(
    moment: AtlasPinMoment
) {
    const start =
        new Date(
            moment.start_at
        );

    if (
        Number.isNaN(
            start.getTime()
        )
    ) {
        return "";
    }

    const dateLabel =
        new Intl.DateTimeFormat(
            "en-US",
            {
                month: "long",
                day: "numeric",
                year: "numeric",
            }
        )
            .format(start)
            .toUpperCase();

    if (
        moment.moment_type ===
        "datetime"
    ) {
        const timeLabel =
            new Intl.DateTimeFormat(
                "en-US",
                {
                    hour: "numeric",
                    minute: "2-digit",
                }
            )
                .format(start)
                .toUpperCase();

        return `${dateLabel} · ${timeLabel}`;
    }

    if (
        moment.moment_type ===
        "range" &&
        moment.end_at
    ) {
        const end =
            new Date(
                moment.end_at
            );

        if (
            !Number.isNaN(
                end.getTime()
            )
        ) {
            const endLabel =
                new Intl.DateTimeFormat(
                    "en-US",
                    {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                    }
                )
                    .format(end)
                    .toUpperCase();

            return `${dateLabel} → ${endLabel}`;
        }
    }

    return dateLabel;
}

/* =========================================
   DERIVED MOMENT TIME STATE

   Once a dated Moment is selected,
   Atlas derives PAST / PRESENT / FUTURE
   from the user's local calendar day.

   Date + time remains PRESENT for its
   full local calendar day.
========================================= */

function getLocalDayStart(
    value: Date
) {
    return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
    );
}

function getMomentTimeState(
    moment: AtlasPinMoment,
    now: Date
): AtlasTimeState {
    const today =
        getLocalDayStart(now);

    const start =
        getLocalDayStart(
            new Date(
                moment.start_at
            )
        );

    if (
        moment.moment_type ===
        "range" &&
        moment.end_at
    ) {
        const end =
            getLocalDayStart(
                new Date(
                    moment.end_at
                )
            );

        if (
            today.getTime() <
            start.getTime()
        ) {
            return "future";
        }

        if (
            today.getTime() >
            end.getTime()
        ) {
            return "past";
        }

        return "present";
    }

    if (
        today.getTime() <
        start.getTime()
    ) {
        return "future";
    }

    if (
        today.getTime() >
        start.getTime()
    ) {
        return "past";
    }

    return "present";
}

/* =========================================
   COMPONENT
========================================= */

export default function AtlasPanel({
    draftPin,
    selectedPin,
    defaultTimeState,
    collections,
    onCancel,
    onSave,
    onUpdate,
    onDelete,
    isRepositioningPin,
    repositionPinPosition,
    onStartRepositionPin,
    onCancelRepositionPin,
    onSaveRepositionPin,
    onPinCoverChange,
    onMomentsChange,
}: AtlasPanelProps) {
    /* =========================================
       CORE
    ========================================= */

    const [supabase] =
        useState(() =>
            createClient()
        );

    const fileInputRef =
        useRef<HTMLInputElement | null>(
            null
        );

    const pinCoverInputRef =
        useRef<HTMLInputElement | null>(
            null
        );

    const bunnyCdnUrl =
        process.env
            .NEXT_PUBLIC_BUNNY_CDN_URL ??
        "";

    const isEditing =
        selectedPin !== null;

    const activeLocation =
        isRepositioningPin &&
            repositionPinPosition
            ? repositionPinPosition
            : selectedPin ??
            draftPin;

    /* =========================================
       PIN STATE
    ========================================= */

    const [
        title,
        setTitle,
    ] = useState("");

    const [
        timeState,
        setTimeState,
    ] =
        useState<AtlasTimeState>(
            defaultTimeState
        );

    const [
        selectedCollections,
        setSelectedCollections,
    ] =
        useState<string[]>([]);

    const [
        description,
        setDescription,
    ] = useState("");

    const [
        notes,
        setNotes,
    ] = useState("");

    const [
        isNotesOpen,
        setIsNotesOpen,
    ] = useState(false);

    const [
        isSaving,
        setIsSaving,
    ] = useState(false);

    const [
        isDeleting,
        setIsDeleting,
    ] = useState(false);

    /* =========================================
       PEOPLE STATE
    ========================================= */

    const [
        people,
        setPeople,
    ] =
        useState<AtlasPerson[]>(
            []
        );

    const [
        personRelationships,
        setPersonRelationships,
    ] =
        useState<
            AtlasPersonPinRelationship[]
        >([]);

    const [
        isLoadingPeople,
        setIsLoadingPeople,
    ] = useState(false);

    const [
        peopleError,
        setPeopleError,
    ] = useState("");

    const [
        isPersonFormOpen,
        setIsPersonFormOpen,
    ] = useState(false);

    const [
        personFormMode,
        setPersonFormMode,
    ] =
        useState<AtlasPersonFormMode>(
            "new"
        );

    const [
        editingPersonRelationshipId,
        setEditingPersonRelationshipId,
    ] =
        useState<string | null>(
            null
        );

    const [
        selectedExistingPersonId,
        setSelectedExistingPersonId,
    ] = useState("");

    const [
        personName,
        setPersonName,
    ] = useState("");

    const [
        personHeadline,
        setPersonHeadline,
    ] = useState("");

    const [
        personCompany,
        setPersonCompany,
    ] = useState("");

    const [
        personCity,
        setPersonCity,
    ] = useState("");

    const [
        personEmail,
        setPersonEmail,
    ] = useState("");

    const [
        personPhone,
        setPersonPhone,
    ] = useState("");

    const [
        personWebsite,
        setPersonWebsite,
    ] = useState("");

    const [
        personBirthday,
        setPersonBirthday,
    ] = useState("");

    const [
        personRoles,
        setPersonRoles,
    ] = useState("");

    const [
        personTags,
        setPersonTags,
    ] = useState("");

    const [
        personNotes,
        setPersonNotes,
    ] = useState("");

    const [
        personRelationshipState,
        setPersonRelationshipState,
    ] =
        useState<
            AtlasPerson["relationship_state"]
        >("active");

    const [
        personRoleInContext,
        setPersonRoleInContext,
    ] = useState("");

    const [
        personContextNotes,
        setPersonContextNotes,
    ] = useState("");

    const [
        personAvatarUrl,
        setPersonAvatarUrl,
    ] = useState("");

    const [
        personAvatarFile,
        setPersonAvatarFile,
    ] =
        useState<File | null>(
            null
        );

    const [
        personAvatarPreview,
        setPersonAvatarPreview,
    ] = useState("");

    const [
        isDraggingPersonImage,
        setIsDraggingPersonImage,
    ] = useState(false);

    const [
        isSavingPerson,
        setIsSavingPerson,
    ] = useState(false);

    const [
        removingPersonRelationshipId,
        setRemovingPersonRelationshipId,
    ] =
        useState<string | null>(
            null
        );

    const personImageInputRef =
        useRef<HTMLInputElement | null>(
            null
        );


    /* =========================================
       PIN WORKSPACE UI
    ========================================= */

    const [
        activePinTab,
        setActivePinTab,
    ] = useState<
        "overview" |
        "content" |
        "people" |
        "tasks"
    >("overview");

    const [
        isPinMenuOpen,
        setIsPinMenuOpen,
    ] = useState(false);

    const [
        isSavingPinPosition,
        setIsSavingPinPosition,
    ] = useState(false);

    const [
        pinPositionError,
        setPinPositionError,
    ] = useState("");

    const [
        isUploadingPinCover,
        setIsUploadingPinCover,
    ] = useState(false);

    const [
        pinCoverError,
        setPinCoverError,
    ] = useState("");

    /* =========================================
       TASK STATE
    ========================================= */

    const [
        tasks,
        setTasks,
    ] =
        useState<AtlasPinTask[]>(
            []
        );

    const [
        isLoadingTasks,
        setIsLoadingTasks,
    ] = useState(false);

    const [
        taskError,
        setTaskError,
    ] = useState("");

    const [
        newTaskTitle,
        setNewTaskTitle,
    ] = useState("");

    const [
        isCreatingTask,
        setIsCreatingTask,
    ] = useState(false);

    const [
        editingTaskId,
        setEditingTaskId,
    ] =
        useState<string | null>(
            null
        );

    const [
        editingTaskTitle,
        setEditingTaskTitle,
    ] = useState("");

    const [
        updatingTaskId,
        setUpdatingTaskId,
    ] =
        useState<string | null>(
            null
        );

    const [
        deletingTaskId,
        setDeletingTaskId,
    ] =
        useState<string | null>(
            null
        );

    /* =========================================
       MEDIA STATE
    ========================================= */

    const [
        media,
        setMedia,
    ] =
        useState<AtlasMedia[]>(
            []
        );

    const [
        isLoadingMedia,
        setIsLoadingMedia,
    ] = useState(false);

    const [
        mediaError,
        setMediaError,
    ] = useState("");

    const [
        selectedFile,
        setSelectedFile,
    ] =
        useState<File | null>(
            null
        );

    const [
        isUploading,
        setIsUploading,
    ] = useState(false);

    const [
        isDraggingFile,
        setIsDraggingFile,
    ] = useState(false);

    const [
        isAddingLink,
        setIsAddingLink,
    ] = useState(false);


    const [
        renamingMediaId,
        setRenamingMediaId,
    ] =
        useState<string | null>(
            null
        );

    const [
        renameValue,
        setRenameValue,
    ] = useState("");

    const [
        isRenaming,
        setIsRenaming,
    ] = useState(false);

    const [
        deletingMediaId,
        setDeletingMediaId,
    ] =
        useState<string | null>(
            null
        );

    const [
        movingMediaId,
        setMovingMediaId,
    ] =
        useState<string | null>(
            null
        );

    const [
        expandedMediaId,
        setExpandedMediaId,
    ] =
        useState<string | null>(
            null
        );

    /* =========================================
       FOLDER STATE
    ========================================= */

    const [
        folders,
        setFolders,
    ] =
        useState<
            AtlasMediaFolder[]
        >([]);

    const [
        isLoadingFolders,
        setIsLoadingFolders,
    ] = useState(false);

    const [
        folderError,
        setFolderError,
    ] = useState("");

    const [
        isNewFolderOpen,
        setIsNewFolderOpen,
    ] = useState(false);

    const [
        newFolderName,
        setNewFolderName,
    ] = useState("");

    const [
        isCreatingFolder,
        setIsCreatingFolder,
    ] = useState(false);

    const [
        renamingFolderId,
        setRenamingFolderId,
    ] =
        useState<string | null>(
            null
        );

    const [
        folderRenameValue,
        setFolderRenameValue,
    ] = useState("");

    const [
        isRenamingFolder,
        setIsRenamingFolder,
    ] = useState(false);

    const [
        deletingFolderId,
        setDeletingFolderId,
    ] =
        useState<string | null>(
            null
        );

    const [
        openFolderId,
        setOpenFolderId,
    ] =
        useState<string | null>(
            null
        );

    const [
        draggedMediaId,
        setDraggedMediaId,
    ] =
        useState<string | null>(
            null
        );

    const [
        dragOverFolderId,
        setDragOverFolderId,
    ] =
        useState<string | null>(
            null
        );

    /* =========================================
       MOMENT STATE
    ========================================= */

    const [
        moments,
        setMoments,
    ] =
        useState<AtlasPinMoment[]>(
            []
        );

    const [
        isLoadingMoments,
        setIsLoadingMoments,
    ] = useState(false);

    const [
        momentError,
        setMomentError,
    ] = useState("");

    const [
        selectedMomentIds,
        setSelectedMomentIds,
    ] =
        useState<string[]>([]);

    const [
        isMomentFormOpen,
        setIsMomentFormOpen,
    ] = useState(false);

    const [
        editingMomentId,
        setEditingMomentId,
    ] =
        useState<string | null>(
            null
        );

    const [
        momentFormType,
        setMomentFormType,
    ] =
        useState<AtlasMomentFormType>(
            "date"
        );

    const [
        momentTitle,
        setMomentTitle,
    ] = useState("");

    const [
        momentStart,
        setMomentStart,
    ] = useState("");

    const [
        momentEnd,
        setMomentEnd,
    ] = useState("");

    const [
        momentNotes,
        setMomentNotes,
    ] = useState("");

    const [
        isSavingMoment,
        setIsSavingMoment,
    ] = useState(false);

    const [
        deletingMomentId,
        setDeletingMomentId,
    ] =
        useState<string | null>(
            null
        );

    const [
        atlasNow,
        setAtlasNow,
    ] = useState(
        () => new Date()
    );

    const selectedMoments =
        moments.filter(
            (moment) =>
                selectedMomentIds.includes(
                    moment.id
                )
        );

    const selectedMoment =
        selectedMoments.length ===
            1
            ? selectedMoments[0]
            : null;

    const isDateLocked =
        selectedMoments.length > 0;

    const derivedTimeStates =
        Array.from(
            new Set(
                selectedMoments.map(
                    (moment) =>
                        getMomentTimeState(
                            moment,
                            atlasNow
                        )
                )
            )
        ) as AtlasTimeState[];


    /*
      ALL = general pin-level content.
      One Moment = content belongs there.
      Multiple Moments = view-only union until
      the user narrows to one creation target.
    */

    const creationMomentId =
        selectedMomentIds.length ===
            1
            ? selectedMomentIds[0]
            : null;

    const isMultiMomentSelection =
        selectedMomentIds.length >
        1;

    const visibleMedia =
        selectedMomentIds.length ===
            0
            ? media
            : media.filter(
                (item) =>
                    item.moment_id !==
                    null &&
                    selectedMomentIds.includes(
                        item.moment_id
                    )
            );

    const visibleFolders =
        selectedMomentIds.length ===
            0
            ? folders
            : folders.filter(
                (folder) =>
                    folder.moment_id !==
                    null &&
                    selectedMomentIds.includes(
                        folder.moment_id
                    )
            );


    const visiblePersonRelationships =
        selectedMomentIds.length ===
            0
            ? personRelationships
            : personRelationships.filter(
                (relationship) =>
                    relationship.moment_id !==
                    null &&
                    selectedMomentIds.includes(
                        relationship.moment_id
                    )
            );

    const availableExistingPeople =
        people.filter(
            (person) =>
                !personRelationships.some(
                    (relationship) =>
                        relationship.person_id ===
                        person.id &&
                        relationship.moment_id ===
                        creationMomentId
                )
        );


    const visibleTasks =
        selectedMomentIds.length ===
            0
            ? tasks
            : tasks.filter(
                (task) =>
                    task.moment_id !==
                    null &&
                    selectedMomentIds.includes(
                        task.moment_id
                    )
            );

    const activeTasks =
        visibleTasks.filter(
            (task) =>
                !task.is_complete
        );

    const completedTasks =
        visibleTasks.filter(
            (task) =>
                task.is_complete
        );

    /* =========================================
       ATLAS CLOCK
  
       Keeps temporal state current while
       Atlas remains open across day changes.
    ========================================= */

    useEffect(() => {
        const interval =
            window.setInterval(
                () => {
                    setAtlasNow(
                        new Date()
                    );
                },
                60 * 1000
            );

        return () => {
            window.clearInterval(
                interval
            );
        };
    }, []);

    /* =========================================
       RESET / POPULATE
    ========================================= */

    useEffect(() => {
        if (selectedPin) {
            setTitle(
                selectedPin.title
            );

            setTimeState(
                selectedPin.timeState
            );

            setSelectedCollections(
                selectedPin.collectionIds
            );

            setDescription(
                selectedPin.description ??
                ""
            );

            setNotes(
                selectedPin.notes ??
                ""
            );

            setIsNotesOpen(
                false
            );

            setSelectedFile(
                null
            );

            setMediaError(
                ""
            );

            setFolderError(
                ""
            );

            setExpandedMediaId(
                null
            );


            setIsNewFolderOpen(
                false
            );

            setNewFolderName("");

            setRenamingFolderId(
                null
            );

            setMomentError(
                ""
            );

            setPeopleError(
                ""
            );

            setTasks([]);
            setTaskError("");
            setNewTaskTitle("");
            setEditingTaskId(null);
            setEditingTaskTitle("");

            setIsPersonFormOpen(
                false
            );

            setEditingPersonRelationshipId(
                null
            );

            setPersonAvatarFile(
                null
            );

            setPersonAvatarPreview(
                ""
            );

            setSelectedMomentIds(
                []
            );

            setIsMomentFormOpen(
                false
            );

            setEditingMomentId(
                null
            );

            return;
        }

        if (draftPin) {
            setTitle(
                draftPin.title ??
                ""
            );

            setTimeState(
                defaultTimeState
            );

            setSelectedCollections(
                []
            );

            setDescription("");
            setNotes("");
            setIsNotesOpen(false);

            setSelectedFile(
                null
            );

            setMedia([]);

            setFolders([]);

            setMediaError(
                ""
            );

            setFolderError(
                ""
            );

            setExpandedMediaId(
                null
            );


            setIsNewFolderOpen(
                false
            );

            setNewFolderName("");

            setRenamingFolderId(
                null
            );

            setMoments([]);

            setPeople([]);

            setPersonRelationships([]);

            setPeopleError(
                ""
            );

            setTasks([]);
            setTaskError("");
            setNewTaskTitle("");
            setEditingTaskId(null);
            setEditingTaskTitle("");

            setIsPersonFormOpen(
                false
            );

            setEditingPersonRelationshipId(
                null
            );

            setPersonAvatarFile(
                null
            );

            setPersonAvatarPreview(
                ""
            );

            setMomentError(
                ""
            );

            setSelectedMomentIds(
                []
            );

            setIsMomentFormOpen(
                false
            );

            setEditingMomentId(
                null
            );
        }
    }, [
        selectedPin,
        draftPin,
        defaultTimeState,
    ]);

    /* =========================================
       LOAD PEOPLE
    ========================================= */

    useEffect(() => {
        const loadPeople =
            async () => {
                if (!selectedPin) {
                    setPeople([]);
                    setPersonRelationships([]);

                    return;
                }

                setIsLoadingPeople(
                    true
                );

                setPeopleError(
                    ""
                );

                try {
                    const [
                        peopleResponse,
                        relationshipsResponse,
                    ] =
                        await Promise.all([
                            fetch(
                                "/api/people"
                            ),

                            fetch(
                                `/api/pins/${encodeURIComponent(
                                    selectedPin.id
                                )}/people`
                            ),
                        ]);

                    const [
                        peopleResult,
                        relationshipsResult,
                    ] =
                        await Promise.all([
                            peopleResponse.json(),
                            relationshipsResponse.json(),
                        ]);

                    if (
                        !peopleResponse.ok
                    ) {
                        throw new Error(
                            peopleResult.error ??
                            "Could not load people."
                        );
                    }

                    if (
                        !relationshipsResponse.ok
                    ) {
                        throw new Error(
                            relationshipsResult.error ??
                            "Could not load people for this Pin."
                        );
                    }

                    setPeople(
                        (
                            peopleResult.people ??
                            []
                        ) as AtlasPerson[]
                    );

                    setPersonRelationships(
                        (
                            relationshipsResult.relationships ??
                            []
                        ) as AtlasPersonPinRelationship[]
                    );
                } catch (error) {
                    console.error(
                        "People loading failed:",
                        error
                    );

                    setPeopleError(
                        error instanceof Error
                            ? error.message
                            : "Unexpected people loading error."
                    );
                } finally {
                    setIsLoadingPeople(
                        false
                    );
                }
            };

        void loadPeople();
    }, [
        selectedPin,
    ]);


    /* =========================================
       LOAD TASKS
    ========================================= */

    useEffect(() => {
        const loadTasks =
            async () => {
                if (!selectedPin) {
                    setTasks([]);
                    return;
                }

                setIsLoadingTasks(
                    true
                );

                setTaskError(
                    ""
                );

                try {
                    const response =
                        await fetch(
                            `/api/pins/${encodeURIComponent(
                                selectedPin.id
                            )}/tasks`
                        );

                    const result =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            result.error ??
                            "Could not load tasks."
                        );
                    }

                    setTasks(
                        (
                            result.tasks ??
                            []
                        ) as AtlasPinTask[]
                    );
                } catch (error) {
                    console.error(
                        "Task loading failed:",
                        error
                    );

                    setTaskError(
                        error instanceof Error
                            ? error.message
                            : "Unexpected task loading error."
                    );
                } finally {
                    setIsLoadingTasks(
                        false
                    );
                }
            };

        void loadTasks();
    }, [
        selectedPin,
    ]);

    /* =========================================
       LOAD MEDIA
    ========================================= */

    useEffect(() => {
        const loadMedia =
            async () => {
                if (!selectedPin) {
                    setMedia([]);

                    return;
                }

                setIsLoadingMedia(
                    true
                );

                setMediaError(
                    ""
                );

                const {
                    data,
                    error,
                } = await supabase
                    .from("media")
                    .select(`
            id,
            pin_id,
            folder_id,
            moment_id,
            name,
            original_name,
            source_type,
            provider,
            storage_path,
            media_type,
            mime_type,
            file_size,
            external_url,
            external_id,
            thumbnail_url,
            metadata,
            created_at,
            updated_at
          `)
                    .eq(
                        "pin_id",
                        selectedPin.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending: true,
                        }
                    );

                if (error) {
                    console.error(
                        "Could not load pin media:",
                        error
                    );

                    setMediaError(
                        "Could not load content."
                    );

                    setIsLoadingMedia(
                        false
                    );

                    return;
                }

                const loadedMedia:
                    AtlasMedia[] =
                    (
                        data ?? []
                    ).map(
                        (item) => {
                            const url =
                                item.source_type ===
                                    "upload" &&
                                    item.storage_path
                                    ? `${bunnyCdnUrl.replace(
                                        /\/$/,
                                        ""
                                    )}/${item.storage_path}`
                                    : item.external_url ??
                                    "";

                            return {
                                ...item,
                                url,
                            } as AtlasMedia;
                        }
                    );

                setMedia(
                    loadedMedia
                );

                setIsLoadingMedia(
                    false
                );
            };

        void loadMedia();
    }, [
        selectedPin,
        supabase,
        bunnyCdnUrl,
    ]);

    /* =========================================
       LOAD FOLDERS
    ========================================= */

    useEffect(() => {
        const loadFolders =
            async () => {
                if (!selectedPin) {
                    setFolders([]);

                    return;
                }

                setIsLoadingFolders(
                    true
                );

                setFolderError(
                    ""
                );

                try {
                    const response =
                        await fetch(
                            `/api/media/folders?pinId=${encodeURIComponent(
                                selectedPin.id
                            )}`
                        );

                    const result =
                        await response.json();

                    if (
                        !response.ok
                    ) {
                        setFolderError(
                            result.error ??
                            "Could not load folders."
                        );

                        return;
                    }

                    setFolders(
                        result.folders ??
                        []
                    );
                } catch (error) {
                    console.error(
                        "Folder loading failed:",
                        error
                    );

                    setFolderError(
                        "Unexpected folder loading error."
                    );
                } finally {
                    setIsLoadingFolders(
                        false
                    );
                }
            };

        void loadFolders();
    }, [
        selectedPin,
    ]);

    /* =========================================
       LOAD MOMENTS
    ========================================= */

    useEffect(() => {
        const loadMoments =
            async () => {
                if (!selectedPin) {
                    setMoments([]);

                    return;
                }

                setIsLoadingMoments(
                    true
                );

                setMomentError(
                    ""
                );

                try {
                    const response =
                        await fetch(
                            `/api/pin-moments?pinId=${encodeURIComponent(
                                selectedPin.id
                            )}`
                        );

                    const result =
                        await response.json();

                    if (
                        !response.ok
                    ) {
                        setMomentError(
                            result.error ??
                            "Could not load moments."
                        );

                        return;
                    }

                    const loadedMoments:
                        AtlasPinMoment[] =
                        result.moments ??
                        [];

                    setMoments(
                        loadedMoments
                    );

                    onMomentsChange(
                        selectedPin.id,
                        loadedMoments
                    );
                } catch (error) {
                    console.error(
                        "Moment loading failed:",
                        error
                    );

                    setMomentError(
                        "Unexpected moment loading error."
                    );
                } finally {
                    setIsLoadingMoments(
                        false
                    );
                }
            };

        void loadMoments();
    }, [
        selectedPin,
    ]);

    if (!activeLocation) {
        return null;
    }

    /* =========================================
       MOMENTS
    ========================================= */

    const resetMomentForm =
        () => {
            setIsMomentFormOpen(
                false
            );

            setEditingMomentId(
                null
            );

            setMomentFormType(
                "date"
            );

            setMomentTitle("");

            setMomentStart("");

            setMomentEnd("");

            setMomentNotes("");
        };

    const openNewMomentForm =
        () => {
            setEditingMomentId(
                null
            );

            setMomentFormType(
                "date"
            );

            setMomentTitle("");

            setMomentStart("");

            setMomentEnd("");

            setMomentNotes("");

            setMomentError(
                ""
            );

            setIsMomentFormOpen(
                true
            );
        };

    const openEditMomentForm = (
        moment: AtlasPinMoment
    ) => {
        setEditingMomentId(
            moment.id
        );

        setMomentFormType(
            moment.moment_type
        );

        setMomentTitle(
            moment.title ??
            ""
        );

        if (
            moment.moment_type ===
            "datetime"
        ) {
            setMomentStart(
                isoToDateTimeInput(
                    moment.start_at
                )
            );
        } else {
            setMomentStart(
                isoToDateInput(
                    moment.start_at
                )
            );
        }

        setMomentEnd(
            moment.end_at
                ? isoToDateInput(
                    moment.end_at
                )
                : ""
        );

        setMomentNotes(
            moment.notes ??
            ""
        );

        setMomentError(
            ""
        );

        setSelectedMomentIds(
            [
                moment.id,
            ]
        );

        setIsMomentFormOpen(
            true
        );
    };

    const handleSaveMoment =
        async () => {
            if (
                !selectedPin ||
                isSavingMoment ||
                !momentStart
            ) {
                return;
            }

            let startAt = "";

            let endAt:
                string | null =
                null;

            try {
                startAt =
                    momentFormType ===
                        "datetime"
                        ? localDateTimeToIso(
                            momentStart
                        )
                        : localDateToIso(
                            momentStart
                        );

                if (
                    momentFormType ===
                    "range"
                ) {
                    if (!momentEnd) {
                        setMomentError(
                            "Choose an end date."
                        );

                        return;
                    }

                    endAt =
                        localDateToIso(
                            momentEnd
                        );
                }
            } catch {
                setMomentError(
                    "That date or time could not be read."
                );

                return;
            }

            setIsSavingMoment(
                true
            );

            setMomentError(
                ""
            );

            try {
                const isEditingMoment =
                    editingMomentId !==
                    null;

                const response =
                    await fetch(
                        isEditingMoment
                            ? `/api/pin-moments/${editingMomentId}`
                            : "/api/pin-moments",
                        {
                            method:
                                isEditingMoment
                                    ? "PATCH"
                                    : "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    ...(isEditingMoment
                                        ? {}
                                        : {
                                            pinId:
                                                selectedPin.id,
                                        }),

                                    title:
                                        momentTitle.trim() ||
                                        null,

                                    momentType:
                                        momentFormType,

                                    startAt,

                                    endAt,

                                    timezone:
                                        getBrowserTimezone(),

                                    notes:
                                        momentNotes.trim() ||
                                        null,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMomentError(
                        result.error ??
                        "Could not save moment."
                    );

                    return;
                }

                const nextMoments =
                    (
                        isEditingMoment
                            ? moments.map(
                                (moment) =>
                                    moment.id ===
                                        editingMomentId
                                        ? result.moment
                                        : moment
                            )
                            : [
                                ...moments,
                                result.moment,
                            ]
                    ).sort(
                        (a, b) =>
                            new Date(
                                a.start_at
                            ).getTime() -
                            new Date(
                                b.start_at
                            ).getTime()
                    );

                setMoments(
                    nextMoments
                );

                onMomentsChange(
                    selectedPin.id,
                    nextMoments
                );

                setSelectedMomentIds(
                    [
                        result.moment.id,
                    ]
                );

                resetMomentForm();
            } catch (error) {
                console.error(
                    "Moment save failed:",
                    error
                );

                setMomentError(
                    "Unexpected moment save error."
                );
            } finally {
                setIsSavingMoment(
                    false
                );
            }
        };

    const handleDeleteMoment =
        async (
            moment: AtlasPinMoment
        ) => {
            if (
                !selectedPin ||
                deletingMomentId
            ) {
                return;
            }

            const label =
                moment.title ||
                formatMomentLongDate(
                    moment
                );

            const confirmed =
                window.confirm(
                    `Delete "${label}" from this pin?`
                );

            if (!confirmed) {
                return;
            }

            setDeletingMomentId(
                moment.id
            );

            setMomentError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/pin-moments/${moment.id}`,
                        {
                            method:
                                "DELETE",
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMomentError(
                        result.error ??
                        "Could not delete moment."
                    );

                    return;
                }

                const nextMoments =
                    moments.filter(
                        (item) =>
                            item.id !==
                            moment.id
                    );

                setMoments(
                    nextMoments
                );

                onMomentsChange(
                    selectedPin.id,
                    nextMoments
                );

                setSelectedMomentIds(
                    (current) =>
                        current.filter(
                            (id) =>
                                id !==
                                moment.id
                        )
                );

                if (
                    editingMomentId ===
                    moment.id
                ) {
                    resetMomentForm();
                }
            } catch (error) {
                console.error(
                    "Moment deletion failed:",
                    error
                );

                setMomentError(
                    "Unexpected moment deletion error."
                );
            } finally {
                setDeletingMomentId(
                    null
                );
            }
        };

    /* =========================================
       COLLECTIONS
    ========================================= */

    const toggleCollection = (
        collectionId: string
    ) => {
        setSelectedCollections(
            (current) => {
                if (
                    current.includes(
                        collectionId
                    )
                ) {
                    return current.filter(
                        (id) =>
                            id !==
                            collectionId
                    );
                }

                return [
                    ...current,
                    collectionId,
                ];
            }
        );
    };

    /* =========================================
       TASKS
    ========================================= */

    const handleCreateTask =
        async () => {
            if (
                !selectedPin ||
                isCreatingTask
            ) {
                return;
            }

            if (
                isMultiMomentSelection
            ) {
                setTaskError(
                    "Select one Moment or ALL before adding a task."
                );

                return;
            }

            const title =
                newTaskTitle.trim();

            if (!title) {
                return;
            }

            if (
                title.length > 50
            ) {
                setTaskError(
                    "Tasks must be 50 characters or fewer."
                );

                return;
            }

            setIsCreatingTask(
                true
            );

            setTaskError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/pins/${encodeURIComponent(
                            selectedPin.id
                        )}/tasks`,
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    title,

                                    momentId:
                                        creationMomentId,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                        "Could not create task."
                    );
                }

                setTasks(
                    (current) => [
                        ...current,
                        result.task as AtlasPinTask,
                    ]
                );

                setNewTaskTitle(
                    ""
                );
            } catch (error) {
                console.error(
                    "Task creation failed:",
                    error
                );

                setTaskError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected task creation error."
                );
            } finally {
                setIsCreatingTask(
                    false
                );
            }
        };

    const handleToggleTask =
        async (
            task: AtlasPinTask
        ) => {
            if (
                !selectedPin ||
                updatingTaskId
            ) {
                return;
            }

            setUpdatingTaskId(
                task.id
            );

            setTaskError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/pins/${encodeURIComponent(
                            selectedPin.id
                        )}/tasks/${encodeURIComponent(
                            task.id
                        )}`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    isComplete:
                                        !task.is_complete,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                        "Could not update task."
                    );
                }

                const updatedTask =
                    result.task as AtlasPinTask;

                setTasks(
                    (current) =>
                        current.map(
                            (item) =>
                                item.id ===
                                    updatedTask.id
                                    ? updatedTask
                                    : item
                        )
                );
            } catch (error) {
                console.error(
                    "Task completion failed:",
                    error
                );

                setTaskError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected task update error."
                );
            } finally {
                setUpdatingTaskId(
                    null
                );
            }
        };

    const beginRenameTask =
        (
            task: AtlasPinTask
        ) => {
            setEditingTaskId(
                task.id
            );

            setEditingTaskTitle(
                task.title
            );

            setTaskError(
                ""
            );
        };

    const cancelRenameTask =
        () => {
            setEditingTaskId(
                null
            );

            setEditingTaskTitle(
                ""
            );
        };

    const handleRenameTask =
        async () => {
            if (
                !selectedPin ||
                !editingTaskId ||
                updatingTaskId
            ) {
                return;
            }

            const title =
                editingTaskTitle.trim();

            if (!title) {
                setTaskError(
                    "Task title cannot be empty."
                );

                return;
            }

            if (
                title.length > 50
            ) {
                setTaskError(
                    "Tasks must be 50 characters or fewer."
                );

                return;
            }

            setUpdatingTaskId(
                editingTaskId
            );

            setTaskError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/pins/${encodeURIComponent(
                            selectedPin.id
                        )}/tasks/${encodeURIComponent(
                            editingTaskId
                        )}`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    title,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                        "Could not rename task."
                    );
                }

                const updatedTask =
                    result.task as AtlasPinTask;

                setTasks(
                    (current) =>
                        current.map(
                            (item) =>
                                item.id ===
                                    updatedTask.id
                                    ? updatedTask
                                    : item
                        )
                );

                cancelRenameTask();
            } catch (error) {
                console.error(
                    "Task rename failed:",
                    error
                );

                setTaskError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected task rename error."
                );
            } finally {
                setUpdatingTaskId(
                    null
                );
            }
        };

    const handleDeleteTask =
        async (
            task: AtlasPinTask
        ) => {
            if (
                !selectedPin ||
                deletingTaskId
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Delete "${task.title}"?`
                );

            if (!confirmed) {
                return;
            }

            setDeletingTaskId(
                task.id
            );

            setTaskError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/pins/${encodeURIComponent(
                            selectedPin.id
                        )}/tasks/${encodeURIComponent(
                            task.id
                        )}`,
                        {
                            method:
                                "DELETE",
                        }
                    );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                        "Could not delete task."
                    );
                }

                setTasks(
                    (current) =>
                        current.filter(
                            (item) =>
                                item.id !==
                                task.id
                        )
                );

                if (
                    editingTaskId ===
                    task.id
                ) {
                    cancelRenameTask();
                }
            } catch (error) {
                console.error(
                    "Task deletion failed:",
                    error
                );

                setTaskError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected task deletion error."
                );
            } finally {
                setDeletingTaskId(
                    null
                );
            }
        };

    /* =========================================
       PEOPLE
    ========================================= */

    const parsePersonList =
        (
            value: string
        ) =>
            Array.from(
                new Set(
                    value
                        .split(",")
                        .map(
                            (item) =>
                                item.trim()
                        )
                        .filter(Boolean)
                )
            );

    const resetPersonForm =
        () => {
            setIsPersonFormOpen(
                false
            );

            setPersonFormMode(
                "new"
            );

            setEditingPersonRelationshipId(
                null
            );

            setSelectedExistingPersonId(
                ""
            );

            setPersonName("");
            setPersonHeadline("");
            setPersonCompany("");
            setPersonCity("");
            setPersonEmail("");
            setPersonPhone("");
            setPersonWebsite("");
            setPersonBirthday("");
            setPersonRoles("");
            setPersonTags("");
            setPersonNotes("");

            setPersonRelationshipState(
                "active"
            );

            setPersonRoleInContext(
                ""
            );

            setPersonContextNotes(
                ""
            );

            setPersonAvatarUrl(
                ""
            );

            setPersonAvatarFile(
                null
            );

            if (
                personAvatarPreview.startsWith(
                    "blob:"
                )
            ) {
                URL.revokeObjectURL(
                    personAvatarPreview
                );
            }

            setPersonAvatarPreview(
                ""
            );

            setIsDraggingPersonImage(
                false
            );

            setPeopleError(
                ""
            );

            if (
                personImageInputRef.current
            ) {
                personImageInputRef.current.value =
                    "";
            }
        };

    const openNewPersonForm =
        () => {
            if (
                isMultiMomentSelection
            ) {
                setPeopleError(
                    "Select one Moment or ALL before adding a person."
                );

                return;
            }

            resetPersonForm();

            setIsPersonFormOpen(
                true
            );
        };

    const openEditPersonForm =
        (
            relationship:
                AtlasPersonPinRelationship
        ) => {
            const person =
                relationship.person;

            resetPersonForm();

            setPersonFormMode(
                "edit"
            );

            setEditingPersonRelationshipId(
                relationship.id
            );

            setSelectedExistingPersonId(
                person.id
            );

            setPersonName(
                person.name
            );

            setPersonHeadline(
                person.headline ??
                ""
            );

            setPersonCompany(
                person.company ??
                ""
            );

            setPersonCity(
                person.city ??
                ""
            );

            setPersonEmail(
                person.email ??
                ""
            );

            setPersonPhone(
                person.phone ??
                ""
            );

            setPersonWebsite(
                person.website ??
                ""
            );

            setPersonBirthday(
                person.birthday ??
                ""
            );

            setPersonRoles(
                person.roles.join(
                    ", "
                )
            );

            setPersonTags(
                person.tags.join(
                    ", "
                )
            );

            setPersonNotes(
                person.notes ??
                ""
            );

            setPersonRelationshipState(
                person.relationship_state
            );

            setPersonRoleInContext(
                relationship.role_in_context ??
                ""
            );

            setPersonContextNotes(
                relationship.notes ??
                ""
            );

            setPersonAvatarUrl(
                person.avatar_url ??
                ""
            );

            setPersonAvatarPreview(
                person.avatar_url ??
                ""
            );

            setIsPersonFormOpen(
                true
            );
        };

    const choosePersonImage =
        (
            file: File | null
        ) => {
            if (!file) {
                return;
            }

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {
                setPeopleError(
                    "Choose an image file for this person."
                );

                return;
            }

            if (
                personAvatarPreview.startsWith(
                    "blob:"
                )
            ) {
                URL.revokeObjectURL(
                    personAvatarPreview
                );
            }

            setPersonAvatarFile(
                file
            );

            setPersonAvatarPreview(
                URL.createObjectURL(
                    file
                )
            );

            setPeopleError(
                ""
            );
        };

    const handlePersonImageDragOver =
        (
            event:
                DragEvent<HTMLDivElement>
        ) => {
            event.preventDefault();

            event.dataTransfer.dropEffect =
                "copy";

            setIsDraggingPersonImage(
                true
            );
        };

    const handlePersonImageDragLeave =
        (
            event:
                DragEvent<HTMLDivElement>
        ) => {
            event.preventDefault();

            setIsDraggingPersonImage(
                false
            );
        };

    const handlePersonImageDrop =
        (
            event:
                DragEvent<HTMLDivElement>
        ) => {
            event.preventDefault();
            event.stopPropagation();

            setIsDraggingPersonImage(
                false
            );

            const file =
                event.dataTransfer
                    .files?.[0] ??
                null;

            if (file) {
                choosePersonImage(
                    file
                );

                return;
            }

            const droppedUrl =
                getDroppedUrl(
                    event.dataTransfer
                );

            if (droppedUrl) {
                if (
                    personAvatarPreview.startsWith(
                        "blob:"
                    )
                ) {
                    URL.revokeObjectURL(
                        personAvatarPreview
                    );
                }

                setPersonAvatarFile(
                    null
                );

                setPersonAvatarUrl(
                    droppedUrl
                );

                setPersonAvatarPreview(
                    droppedUrl
                );

                setPeopleError(
                    ""
                );

                return;
            }

            setPeopleError(
                "Drop an image file or image URL."
            );
        };

    const uploadPersonAvatar =
        async () => {
            if (
                !personAvatarFile
            ) {
                return (
                    personAvatarUrl.trim() ||
                    null
                );
            }

            const formData =
                new FormData();

            formData.append(
                "file",
                personAvatarFile
            );

            const response =
                await fetch(
                    "/api/people/avatar",
                    {
                        method:
                            "POST",

                        body:
                            formData,
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ??
                    "Could not upload person image."
                );
            }

            return (
                result.avatarUrl as string
            );
        };

    const attachPersonToCurrentState =
        async (
            personId: string
        ) => {
            if (!selectedPin) {
                throw new Error(
                    "Save this Pin before adding people."
                );
            }

            const response =
                await fetch(
                    `/api/pins/${encodeURIComponent(
                        selectedPin.id
                    )}/people`,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                personId,

                                momentId:
                                    creationMomentId,

                                roleInContext:
                                    personRoleInContext.trim() ||
                                    null,

                                notes:
                                    personContextNotes.trim() ||
                                    null,
                            }),
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error ??
                    "Could not add this person to the current state."
                );
            }

            return (
                result.relationship as
                AtlasPersonPinRelationship
            );
        };

    const handleSavePerson =
        async () => {
            if (
                !selectedPin ||
                isSavingPerson
            ) {
                return;
            }

            if (
                isMultiMomentSelection &&
                personFormMode !==
                "edit"
            ) {
                setPeopleError(
                    "Select one Moment or ALL before adding a person."
                );

                return;
            }

            setIsSavingPerson(
                true
            );

            setPeopleError(
                ""
            );

            try {
                /* ---------------------------------
                   ATTACH EXISTING PERSON
                --------------------------------- */

                if (
                    personFormMode ===
                    "existing"
                ) {
                    if (
                        !selectedExistingPersonId
                    ) {
                        throw new Error(
                            "Choose a person to attach."
                        );
                    }

                    const relationship =
                        await attachPersonToCurrentState(
                            selectedExistingPersonId
                        );

                    setPersonRelationships(
                        (current) => [
                            ...current,
                            relationship,
                        ]
                    );

                    resetPersonForm();

                    return;
                }

                const cleanedName =
                    personName.trim();

                if (!cleanedName) {
                    throw new Error(
                        "Person name is required."
                    );
                }

                const avatarUrl =
                    await uploadPersonAvatar();

                const personPayload = {
                    name:
                        cleanedName,

                    avatarUrl:
                        avatarUrl ??
                        null,

                    headline:
                        personHeadline.trim() ||
                        null,

                    company:
                        personCompany.trim() ||
                        null,

                    city:
                        personCity.trim() ||
                        null,

                    email:
                        personEmail.trim() ||
                        null,

                    phone:
                        personPhone.trim() ||
                        null,

                    website:
                        personWebsite.trim() ||
                        null,

                    birthday:
                        personBirthday ||
                        null,

                    roles:
                        parsePersonList(
                            personRoles
                        ),

                    tags:
                        parsePersonList(
                            personTags
                        ),

                    relationshipState:
                        personRelationshipState,

                    notes:
                        personNotes.trim() ||
                        null,
                };

                /* ---------------------------------
                   EDIT EXISTING PERSON + CONTEXT
                --------------------------------- */

                if (
                    personFormMode ===
                    "edit" &&
                    editingPersonRelationshipId &&
                    selectedExistingPersonId
                ) {
                    const personResponse =
                        await fetch(
                            `/api/people/${encodeURIComponent(
                                selectedExistingPersonId
                            )}`,
                            {
                                method:
                                    "PATCH",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body:
                                    JSON.stringify(
                                        personPayload
                                    ),
                            }
                        );

                    const personResult =
                        await personResponse.json();

                    if (
                        !personResponse.ok
                    ) {
                        throw new Error(
                            personResult.error ??
                            "Could not update person."
                        );
                    }

                    const relationshipResponse =
                        await fetch(
                            `/api/pins/${encodeURIComponent(
                                selectedPin.id
                            )}/people/${encodeURIComponent(
                                editingPersonRelationshipId
                            )}`,
                            {
                                method:
                                    "PATCH",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body:
                                    JSON.stringify({
                                        roleInContext:
                                            personRoleInContext.trim() ||
                                            null,

                                        notes:
                                            personContextNotes.trim() ||
                                            null,
                                    }),
                            }
                        );

                    const relationshipResult =
                        await relationshipResponse.json();

                    if (
                        !relationshipResponse.ok
                    ) {
                        throw new Error(
                            relationshipResult.error ??
                            "Person updated, but this Pin context could not be updated."
                        );
                    }

                    const updatedPerson =
                        personResult.person as
                        AtlasPerson;

                    const updatedRelationship =
                        relationshipResult.relationship as
                        AtlasPersonPinRelationship;

                    setPeople(
                        (current) =>
                            current.map(
                                (person) =>
                                    person.id ===
                                        updatedPerson.id
                                        ? updatedPerson
                                        : person
                            )
                    );

                    setPersonRelationships(
                        (current) =>
                            current.map(
                                (relationship) =>
                                    relationship.id ===
                                        updatedRelationship.id
                                        ? {
                                            ...updatedRelationship,
                                            person:
                                                updatedPerson,
                                        }
                                        : relationship
                            )
                    );

                    resetPersonForm();

                    return;
                }

                /* ---------------------------------
                   CREATE PERSON + ATTACH
                --------------------------------- */

                const personResponse =
                    await fetch(
                        "/api/people",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify(
                                    personPayload
                                ),
                        }
                    );

                const personResult =
                    await personResponse.json();

                if (
                    !personResponse.ok
                ) {
                    throw new Error(
                        personResult.error ??
                        "Could not create person."
                    );
                }

                const createdPerson =
                    personResult.person as
                    AtlasPerson;

                try {
                    const relationship =
                        await attachPersonToCurrentState(
                            createdPerson.id
                        );

                    setPeople(
                        (current) =>
                            [
                                ...current,
                                createdPerson,
                            ].sort(
                                (a, b) =>
                                    a.name.localeCompare(
                                        b.name
                                    )
                            )
                    );

                    setPersonRelationships(
                        (current) => [
                            ...current,
                            {
                                ...relationship,
                                person:
                                    createdPerson,
                            },
                        ]
                    );

                    resetPersonForm();
                } catch (relationshipError) {
                    /*
                      Person remains globally saved even if
                      the contextual attach fails. That keeps
                      identity data safe and allows attaching
                      them again without recreating them.
                    */

                    setPeople(
                        (current) =>
                            current.some(
                                (person) =>
                                    person.id ===
                                    createdPerson.id
                            )
                                ? current
                                : [
                                    ...current,
                                    createdPerson,
                                ]
                    );

                    throw relationshipError;
                }
            } catch (error) {
                console.error(
                    "Person save failed:",
                    error
                );

                setPeopleError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected person save error."
                );
            } finally {
                setIsSavingPerson(
                    false
                );
            }
        };

    const handleRemovePersonFromState =
        async () => {
            if (
                !selectedPin ||
                !editingPersonRelationshipId ||
                removingPersonRelationshipId
            ) {
                return;
            }

            const relationship =
                personRelationships.find(
                    (item) =>
                        item.id ===
                        editingPersonRelationshipId
                );

            if (!relationship) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Remove "${relationship.person.name}" from this Pin state? The Person record will remain in Atlas.`
                );

            if (!confirmed) {
                return;
            }

            setRemovingPersonRelationshipId(
                relationship.id
            );

            setPeopleError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/pins/${encodeURIComponent(
                            selectedPin.id
                        )}/people/${encodeURIComponent(
                            relationship.id
                        )}`,
                        {
                            method:
                                "DELETE",
                        }
                    );

                const result =
                    await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ??
                        "Could not remove this person from the current state."
                    );
                }

                setPersonRelationships(
                    (current) =>
                        current.filter(
                            (item) =>
                                item.id !==
                                relationship.id
                        )
                );

                resetPersonForm();
            } catch (error) {
                console.error(
                    "Person relationship removal failed:",
                    error
                );

                setPeopleError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected person removal error."
                );
            } finally {
                setRemovingPersonRelationshipId(
                    null
                );
            }
        };

    /* =========================================
       CREATE FOLDER
    ========================================= */

    const handleCreateFolder =
        async () => {
            if (
                !selectedPin ||
                isCreatingFolder
            ) {
                return;
            }

            if (
                isMultiMomentSelection
            ) {
                setFolderError(
                    "Select one Moment or ALL before creating a folder."
                );

                return;
            }

            const name =
                newFolderName.trim();

            if (!name) {
                setFolderError(
                    "Folder name is required."
                );

                return;
            }

            setIsCreatingFolder(
                true
            );

            setFolderError(
                ""
            );

            try {
                const response =
                    await fetch(
                        "/api/media/folders",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    pinId:
                                        selectedPin.id,

                                    momentId:
                                        creationMomentId,

                                    name,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setFolderError(
                        result.error ??
                        "Could not create folder."
                    );

                    return;
                }

                setFolders(
                    (current) => [
                        ...current,
                        result.folder,
                    ]
                );

                setNewFolderName("");

                setIsNewFolderOpen(
                    false
                );
            } catch (error) {
                console.error(
                    "Folder creation failed:",
                    error
                );

                setFolderError(
                    "Unexpected folder creation error."
                );
            } finally {
                setIsCreatingFolder(
                    false
                );
            }
        };

    /* =========================================
       RENAME FOLDER
    ========================================= */

    const startRenameFolder = (
        folder: AtlasMediaFolder
    ) => {
        setRenamingFolderId(
            folder.id
        );

        setFolderRenameValue(
            folder.name
        );

        setFolderError(
            ""
        );
    };

    const cancelRenameFolder =
        () => {
            setRenamingFolderId(
                null
            );

            setFolderRenameValue(
                ""
            );
        };

    const handleRenameFolder =
        async (
            folderId: string
        ) => {
            const name =
                folderRenameValue.trim();

            if (
                !name ||
                isRenamingFolder
            ) {
                return;
            }

            setIsRenamingFolder(
                true
            );

            setFolderError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/media/folders/${folderId}`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    name,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setFolderError(
                        result.error ??
                        "Could not rename folder."
                    );

                    return;
                }

                setFolders(
                    (current) =>
                        current.map(
                            (folder) =>
                                folder.id ===
                                    folderId
                                    ? result.folder
                                    : folder
                        )
                );

                cancelRenameFolder();
            } catch (error) {
                console.error(
                    "Folder rename failed:",
                    error
                );

                setFolderError(
                    "Unexpected folder rename error."
                );
            } finally {
                setIsRenamingFolder(
                    false
                );
            }
        };

    /* =========================================
       DELETE FOLDER
    ========================================= */

    const handleDeleteFolder =
        async (
            folder: AtlasMediaFolder
        ) => {
            if (
                deletingFolderId
            ) {
                return;
            }

            const contentCount =
                media.filter(
                    (item) =>
                        item.folder_id ===
                        folder.id
                ).length;

            const message =
                contentCount > 0
                    ? `Delete "${folder.name}"? Its ${contentCount} content item${contentCount === 1 ? "" : "s"} will move to Loose Content.`
                    : `Delete "${folder.name}"?`;

            const confirmed =
                window.confirm(
                    message
                );

            if (!confirmed) {
                return;
            }

            setDeletingFolderId(
                folder.id
            );

            setFolderError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/media/folders/${folder.id}`,
                        {
                            method:
                                "DELETE",
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setFolderError(
                        result.error ??
                        "Could not delete folder."
                    );

                    return;
                }

                setFolders(
                    (current) =>
                        current.filter(
                            (item) =>
                                item.id !==
                                folder.id
                        )
                );

                /*
                  Database uses ON DELETE SET NULL.
                  Mirror that immediately in local state.
                */

                setMedia(
                    (current) =>
                        current.map(
                            (item) =>
                                item.folder_id ===
                                    folder.id
                                    ? {
                                        ...item,
                                        folder_id:
                                            null,
                                    }
                                    : item
                        )
                );
            } catch (error) {
                console.error(
                    "Folder deletion failed:",
                    error
                );

                setFolderError(
                    "Unexpected folder deletion error."
                );
            } finally {
                setDeletingFolderId(
                    null
                );
            }
        };

    /* =========================================
       MOVE CONTENT
    ========================================= */

    const handleMoveMedia =
        async (
            item: AtlasMedia,
            folderId: string | null
        ) => {
            if (
                movingMediaId
            ) {
                return;
            }

            if (
                item.folder_id ===
                folderId
            ) {
                return;
            }

            setMovingMediaId(
                item.id
            );

            setMediaError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/media/${item.id}`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    folderId,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMediaError(
                        result.error ??
                        "Could not move content."
                    );

                    return;
                }

                setMedia(
                    (current) =>
                        current.map(
                            (mediaItem) =>
                                mediaItem.id ===
                                    item.id
                                    ? {
                                        ...mediaItem,

                                        folder_id:
                                            result.media
                                                .folder_id,

                                        updated_at:
                                            result.media
                                                .updated_at,
                                    }
                                    : mediaItem
                        )
                );
            } catch (error) {
                console.error(
                    "Media move failed:",
                    error
                );

                setMediaError(
                    "Unexpected move error."
                );
            } finally {
                setMovingMediaId(
                    null
                );
            }
        };

    /* =========================================
       FILE SELECTION
    ========================================= */

    const chooseFile = (
        file: File | null
    ) => {
        if (!file) {
            return;
        }

        if (
            isMultiMomentSelection
        ) {
            setMediaError(
                "Select one Moment or ALL before adding content."
            );

            return;
        }

        setSelectedFile(
            file
        );

        setMediaError(
            ""
        );
    };

    /* =========================================
       CREATE LINK
    ========================================= */

    const handleCreateLink =
        async (
            rawUrl?: string
        ) => {
            if (
                !selectedPin ||
                isAddingLink
            ) {
                return;
            }

            const url =
                (
                    rawUrl ??
                    ""
                ).trim();

            if (!url) {
                setMediaError(
                    "Enter or drop a valid URL."
                );

                return;
            }

            if (
                isMultiMomentSelection
            ) {
                setMediaError(
                    "Select one Moment or ALL before adding content."
                );

                return;
            }

            setIsAddingLink(
                true
            );

            setMediaError(
                ""
            );

            try {
                const response =
                    await fetch(
                        "/api/media/link",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    pinId:
                                        selectedPin.id,

                                    url,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMediaError(
                        result.error ??
                        "Could not add link."
                    );

                    return;
                }

                let linked:
                    AtlasMedia = {
                    ...result.media,

                    moment_id:
                        result.media
                            .moment_id ??
                        null,

                    url:
                        result.media.url ??
                        result.media
                            .external_url ??
                        url,
                };

                if (
                    creationMomentId
                ) {
                    const attachResponse =
                        await fetch(
                            `/api/media/${linked.id}`,
                            {
                                method:
                                    "PATCH",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body:
                                    JSON.stringify({
                                        momentId:
                                            creationMomentId,
                                    }),
                            }
                        );

                    const attachResult =
                        await attachResponse.json();

                    if (
                        !attachResponse.ok
                    ) {
                        setMediaError(
                            attachResult.error ??
                            "Content was added, but Atlas could not attach it to this Moment."
                        );

                        return;
                    }

                    linked = {
                        ...linked,
                        moment_id:
                            attachResult.media
                                .moment_id,
                        folder_id:
                            attachResult.media
                                .folder_id,
                        updated_at:
                            attachResult.media
                                .updated_at,
                    };
                }

                setMedia(
                    (current) => [
                        ...current,
                        linked,
                    ]
                );

            } catch (error) {
                console.error(
                    "Media link creation failed:",
                    error
                );

                setMediaError(
                    "Unexpected link error."
                );
            } finally {
                setIsAddingLink(
                    false
                );
            }
        };

    /* =========================================
       DRAG AND DROP
    ========================================= */

    const handleDragOver = (
        event:
            DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();

        event.dataTransfer.dropEffect =
            "copy";

        setIsDraggingFile(
            true
        );
    };

    const handleDragLeave = (
        event:
            DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();

        setIsDraggingFile(
            false
        );
    };

    const handleDrop = (
        event:
            DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault();

        event.stopPropagation();

        setIsDraggingFile(
            false
        );

        const file =
            event.dataTransfer
                .files?.[0] ??
            null;

        if (file) {
            chooseFile(
                file
            );

            return;
        }

        const droppedUrl =
            getDroppedUrl(
                event.dataTransfer
            );

        if (droppedUrl) {
            void handleCreateLink(
                droppedUrl
            );

            return;
        }

        setMediaError(
            "Atlas could not read that drop as a file or link."
        );
    };

    /* =========================================
       PIN COVER IMAGE

       Cover uploads are always general Pin-level
       media. They never inherit the selected Moment.
    ========================================= */

    const handleUploadPinCover =
        async (
            file: File
        ) => {
            if (
                !selectedPin ||
                isUploadingPinCover
            ) {
                return;
            }

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {
                setPinCoverError(
                    "Choose an image file."
                );

                return;
            }

            setIsUploadingPinCover(
                true
            );

            setPinCoverError(
                ""
            );

            try {
                const formData =
                    new FormData();

                formData.append(
                    "file",
                    file
                );

                formData.append(
                    "pinId",
                    selectedPin.id
                );

                const response =
                    await fetch(
                        "/api/media/upload",
                        {
                            method:
                                "POST",

                            body:
                                formData,
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setPinCoverError(
                        result.error ??
                        "Image upload failed."
                    );

                    return;
                }

                const uploaded:
                    AtlasMedia = {
                    ...result.media,

                    moment_id:
                        result.media
                            .moment_id ??
                        null,

                    url:
                        result.media.url,
                };

                await onPinCoverChange(
                    selectedPin.id,
                    uploaded.id,
                    uploaded.url
                );

                setMedia(
                    (current) => {
                        const alreadyExists =
                            current.some(
                                (item) =>
                                    item.id ===
                                    uploaded.id
                            );

                        return alreadyExists
                            ? current
                            : [
                                ...current,
                                uploaded,
                            ];
                    }
                );

                setIsPinMenuOpen(
                    false
                );
            } catch (error) {
                console.error(
                    "Pin cover upload failed:",
                    error
                );

                setPinCoverError(
                    error instanceof Error
                        ? error.message
                        : "Unexpected Pin image error."
                );
            } finally {
                setIsUploadingPinCover(
                    false
                );

                if (
                    pinCoverInputRef.current
                ) {
                    pinCoverInputRef.current.value =
                        "";
                }
            }
        };


    const handleRemovePinCover =
        async () => {
            if (
                !selectedPin ||
                isUploadingPinCover
            ) {
                return;
            }

            setIsUploadingPinCover(
                true
            );

            setPinCoverError(
                ""
            );

            try {
                await onPinCoverChange(
                    selectedPin.id,
                    null
                );

                setIsPinMenuOpen(
                    false
                );
            } catch (error) {
                console.error(
                    "Pin cover removal failed:",
                    error
                );

                setPinCoverError(
                    error instanceof Error
                        ? error.message
                        : "Could not remove Pin image."
                );
            } finally {
                setIsUploadingPinCover(
                    false
                );
            }
        };


    /* =========================================
       UPLOAD MEDIA
    ========================================= */

    const handleUploadMedia =
        async () => {
            if (
                !selectedPin ||
                !selectedFile ||
                isUploading
            ) {
                return;
            }

            if (
                isMultiMomentSelection
            ) {
                setMediaError(
                    "Select one Moment or ALL before uploading content."
                );

                return;
            }

            setIsUploading(
                true
            );

            setMediaError(
                ""
            );

            try {
                const formData =
                    new FormData();

                formData.append(
                    "file",
                    selectedFile
                );

                formData.append(
                    "pinId",
                    selectedPin.id
                );

                const response =
                    await fetch(
                        "/api/media/upload",
                        {
                            method:
                                "POST",

                            body:
                                formData,
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMediaError(
                        result.error ??
                        "Upload failed."
                    );

                    return;
                }

                let uploaded:
                    AtlasMedia = {
                    ...result.media,

                    moment_id:
                        result.media
                            .moment_id ??
                        null,

                    url:
                        result.media.url,
                };

                if (
                    creationMomentId
                ) {
                    const attachResponse =
                        await fetch(
                            `/api/media/${uploaded.id}`,
                            {
                                method:
                                    "PATCH",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body:
                                    JSON.stringify({
                                        momentId:
                                            creationMomentId,
                                    }),
                            }
                        );

                    const attachResult =
                        await attachResponse.json();

                    if (
                        !attachResponse.ok
                    ) {
                        setMediaError(
                            attachResult.error ??
                            "Upload succeeded, but Atlas could not attach it to this Moment."
                        );

                        return;
                    }

                    uploaded = {
                        ...uploaded,
                        moment_id:
                            attachResult.media
                                .moment_id,
                        folder_id:
                            attachResult.media
                                .folder_id,
                        updated_at:
                            attachResult.media
                                .updated_at,
                    };
                }

                setMedia(
                    (current) => [
                        ...current,
                        uploaded,
                    ]
                );

                setSelectedFile(
                    null
                );

                if (
                    fileInputRef.current
                ) {
                    fileInputRef.current.value =
                        "";
                }
            } catch (error) {
                console.error(
                    "Media upload failed:",
                    error
                );

                setMediaError(
                    "Unexpected upload error."
                );
            } finally {
                setIsUploading(
                    false
                );
            }
        };

    /* =========================================
       RENAME MEDIA
    ========================================= */

    const startRename = (
        item: AtlasMedia
    ) => {
        setRenamingMediaId(
            item.id
        );

        setRenameValue(
            item.name
        );
    };

    const cancelRename =
        () => {
            setRenamingMediaId(
                null
            );

            setRenameValue(
                ""
            );
        };

    const handleRenameMedia =
        async (
            mediaId: string
        ) => {
            const cleanedName =
                renameValue.trim();

            if (
                !cleanedName ||
                isRenaming
            ) {
                return;
            }

            setIsRenaming(
                true
            );

            setMediaError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/media/${mediaId}`,
                        {
                            method:
                                "PATCH",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    name:
                                        cleanedName,
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMediaError(
                        result.error ??
                        "Rename failed."
                    );

                    return;
                }

                setMedia(
                    (current) =>
                        current.map(
                            (item) =>
                                item.id ===
                                    mediaId
                                    ? {
                                        ...item,

                                        name:
                                            result.media
                                                .name,

                                        updated_at:
                                            result.media
                                                .updated_at,
                                    }
                                    : item
                        )
                );

                cancelRename();
            } catch (error) {
                console.error(
                    "Media rename failed:",
                    error
                );

                setMediaError(
                    "Unexpected rename error."
                );
            } finally {
                setIsRenaming(
                    false
                );
            }
        };

    /* =========================================
       DELETE MEDIA
    ========================================= */

    const handleDeleteMedia =
        async (
            item: AtlasMedia
        ) => {
            if (
                deletingMediaId
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Delete "${item.name}"?`
                );

            if (!confirmed) {
                return;
            }

            setDeletingMediaId(
                item.id
            );

            setMediaError(
                ""
            );

            try {
                const response =
                    await fetch(
                        `/api/media/${item.id}`,
                        {
                            method:
                                "DELETE",
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok
                ) {
                    setMediaError(
                        result.error ??
                        "Delete failed."
                    );

                    return;
                }

                setMedia(
                    (current) =>
                        current.filter(
                            (mediaItem) =>
                                mediaItem.id !==
                                item.id
                        )
                );

                if (
                    selectedPin?.coverMediaId ===
                    item.id
                ) {
                    await onPinCoverChange(
                        selectedPin.id,
                        null
                    );
                }

                if (
                    expandedMediaId ===
                    item.id
                ) {
                    setExpandedMediaId(
                        null
                    );
                }
            } catch (error) {
                console.error(
                    "Media deletion failed:",
                    error
                );

                setMediaError(
                    "Unexpected delete error."
                );
            } finally {
                setDeletingMediaId(
                    null
                );
            }
        };

    /* =========================================
       SAVE PIN
    ========================================= */

    const handleSave =
        async () => {
            const cleanedTitle =
                title.trim();

            if (
                !cleanedTitle ||
                isSaving ||
                isDeleting
            ) {
                return;
            }

            setIsSaving(
                true
            );

            try {
                if (selectedPin) {
                    const updatedPin:
                        AtlasPin = {
                        ...selectedPin,

                        title:
                            cleanedTitle,

                        timeState,

                        collectionIds:
                            selectedCollections,

                        description:
                            description.trim() ||
                            undefined,

                        notes:
                            notes.trim() ||
                            undefined,
                    };

                    await onUpdate(
                        updatedPin
                    );

                    return;
                }

                if (!draftPin) {
                    return;
                }

                const newPin:
                    AtlasPin = {
                    id:
                        crypto.randomUUID(),

                    title:
                        cleanedTitle,

                    latitude:
                        draftPin.latitude,

                    longitude:
                        draftPin.longitude,

                    timeState,

                    collectionIds:
                        selectedCollections,

                    description:
                        description.trim() ||
                        undefined,

                    notes:
                        notes.trim() ||
                        undefined,

                    placeProvider:
                        draftPin.placeProvider,

                    externalPlaceId:
                        draftPin.externalPlaceId,

                    formattedAddress:
                        draftPin.formattedAddress,

                    placeType:
                        draftPin.placeType,
                };

                let initialMoment:
                    AtlasInitialMomentInput | null =
                    null;

                if (
                    isMomentFormOpen &&
                    momentStart
                ) {
                    let startAt = "";

                    let endAt:
                        string | null =
                        null;

                    try {
                        startAt =
                            momentFormType ===
                                "datetime"
                                ? localDateTimeToIso(
                                    momentStart
                                )
                                : localDateToIso(
                                    momentStart
                                );

                        if (
                            momentFormType ===
                            "range"
                        ) {
                            if (!momentEnd) {
                                setMomentError(
                                    "Choose an end date."
                                );

                                return;
                            }

                            endAt =
                                localDateToIso(
                                    momentEnd
                                );
                        }
                    } catch {
                        setMomentError(
                            "That date or time could not be read."
                        );

                        return;
                    }

                    initialMoment = {
                        title:
                            momentTitle.trim() ||
                            null,

                        momentType:
                            momentFormType,

                        startAt,

                        endAt,

                        timezone:
                            getBrowserTimezone(),

                        notes:
                            momentNotes.trim() ||
                            null,
                    };
                }

                await onSave(
                    newPin,
                    initialMoment
                );
            } finally {
                setIsSaving(
                    false
                );
            }
        };

    /* =========================================
       SAVE PIN POSITION
    ========================================= */

    const handleSavePinPosition =
        async () => {
            if (
                !isRepositioningPin ||
                isSavingPinPosition
            ) {
                return;
            }

            setIsSavingPinPosition(
                true
            );

            setPinPositionError(
                ""
            );

            try {
                await onSaveRepositionPin();
            } catch (error) {
                console.error(
                    "Pin position save failed:",
                    error
                );

                setPinPositionError(
                    error instanceof Error
                        ? error.message
                        : "Could not save Pin position."
                );
            } finally {
                setIsSavingPinPosition(
                    false
                );
            }
        };


    /* =========================================
       DELETE PIN
    ========================================= */

    const handleDelete =
        async () => {
            if (
                !selectedPin ||
                isDeleting ||
                isSaving
            ) {
                return;
            }

            const confirmed =
                window.confirm(
                    `Delete "${selectedPin.title}" from Life Atlas?`
                );

            if (!confirmed) {
                return;
            }

            setIsDeleting(
                true
            );

            try {
                await onDelete(
                    selectedPin.id
                );
            } finally {
                setIsDeleting(
                    false
                );
            }
        };

    /* =========================================
       PREVIEW
    ========================================= */

    const renderPreview = (
        item: AtlasMedia
    ) => {
        if (
            expandedMediaId !==
            item.id
        ) {
            return null;
        }

        if (
            item.media_type ===
            "image"
        ) {
            return (
                <div className="atlas-media-preview">
                    <img
                        src={
                            item.url
                        }
                        alt={
                            item.name
                        }
                    />
                </div>
            );
        }

        if (
            item.media_type ===
            "video"
        ) {
            return (
                <div className="atlas-media-preview">
                    <video
                        src={
                            item.url
                        }
                        controls
                        preload="metadata"
                    />
                </div>
            );
        }

        if (
            item.media_type ===
            "audio"
        ) {
            return (
                <div className="atlas-media-preview">
                    <audio
                        src={
                            item.url
                        }
                        controls
                        preload="metadata"
                    />
                </div>
            );
        }

        if (
            item.media_type ===
            "youtube" &&
            item.external_id
        ) {
            return (
                <div className="atlas-media-preview atlas-media-preview--embed">
                    <iframe
                        src={`https://www.youtube.com/embed/${item.external_id}`}
                        title={
                            item.name
                        }
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            );
        }

        if (
            item.media_type ===
            "youtube_playlist" &&
            item.external_id
        ) {
            return (
                <div className="atlas-media-preview atlas-media-preview--embed">
                    <iframe
                        src={`https://www.youtube.com/embed/videoseries?list=${item.external_id}`}
                        title={
                            item.name
                        }
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            );
        }

        return (
            <div className="atlas-media-preview atlas-media-file-link">
                <a
                    href={
                        item.url
                    }
                    target="_blank"
                    rel="noreferrer"
                >
                    {item.media_type ===
                        "pdf"
                        ? "OPEN PDF"
                        : item.media_type ===
                            "website"
                            ? "OPEN WEBSITE"
                            : "OPEN FILE"}
                </a>
            </div>
        );
    };

    /* =========================================
       MEDIA ROW
    ========================================= */

    const renderMediaItem = (
        item: AtlasMedia
    ) => {
        const isRenamingThis =
            renamingMediaId ===
            item.id;

        const isDeletingThis =
            deletingMediaId ===
            item.id;

        const isMovingThis =
            movingMediaId ===
            item.id;

        const isExpanded =
            expandedMediaId ===
            item.id;

        const handleOpenMedia =
            () => {
                if (
                    item.media_type ===
                    "website"
                ) {
                    window.open(
                        item.url,
                        "_blank",
                        "noopener,noreferrer"
                    );

                    return;
                }

                setExpandedMediaId(
                    isExpanded
                        ? null
                        : item.id
                );
            };

        const primaryActionLabel =
            item.media_type ===
                "website"
                ? "OPEN"
                : isExpanded
                    ? "CLOSE"
                    : item.media_type ===
                        "audio"
                        ? "PLAY"
                        : "VIEW";

        return (
            <article
                key={
                    item.id
                }
                className="atlas-media-item"
                draggable={
                    !isRenamingThis &&
                    !isMovingThis
                }
                onDragStart={(
                    event
                ) => {
                    setDraggedMediaId(
                        item.id
                    );

                    event.dataTransfer.effectAllowed =
                        "move";

                    event.dataTransfer.setData(
                        "text/plain",
                        item.id
                    );
                }}
                onDragEnd={() => {
                    setDraggedMediaId(
                        null
                    );

                    setDragOverFolderId(
                        null
                    );
                }}
                style={{
                    opacity:
                        draggedMediaId ===
                            item.id
                            ? 0.5
                            : 1,
                }}
            >
                <div className="atlas-media-row">
                    {isRenamingThis ? (
                        <>
                            <div className="atlas-media-info">
                                <input
                                    className="atlas-media-rename-input"
                                    value={
                                        renameValue
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setRenameValue(
                                            event.target.value
                                        )
                                    }
                                    onKeyDown={(
                                        event
                                    ) => {
                                        if (
                                            event.key ===
                                            "Enter"
                                        ) {
                                            event.preventDefault();

                                            void handleRenameMedia(
                                                item.id
                                            );
                                        }

                                        if (
                                            event.key ===
                                            "Escape"
                                        ) {
                                            event.preventDefault();

                                            cancelRename();
                                        }
                                    }}
                                    autoFocus
                                />

                                <div className="atlas-media-meta">
                                    {item.media_type.toUpperCase()}
                                    {" / "}
                                    {item.source_type ===
                                        "upload"
                                        ? "UPLOAD"
                                        : "LINK"}

                                    {item.source_type ===
                                        "upload" &&
                                        item.file_size
                                        ? ` / ${formatFileSize(
                                            item.file_size
                                        )}`
                                        : ""}
                                </div>
                            </div>

                            <div className="atlas-media-actions">
                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleRenameMedia(
                                            item.id
                                        )
                                    }
                                    disabled={
                                        isRenaming
                                    }
                                >
                                    {isRenaming
                                        ? "SAVING"
                                        : "SAVE"}
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        cancelRename
                                    }
                                >
                                    CANCEL
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={
                                    handleOpenMedia
                                }
                                aria-expanded={
                                    item.media_type ===
                                        "website"
                                        ? undefined
                                        : isExpanded
                                }
                                style={{
                                    appearance: "none",
                                    width: "100%",
                                    minHeight: 68,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 24,
                                    border: "1px solid rgba(141, 228, 255, 0.08)",
                                    padding: "14px 16px",
                                    background: "rgba(39, 199, 255, 0.012)",
                                    color: "inherit",
                                    textAlign: "left",
                                    cursor: "pointer",
                                }}
                            >
                                <span
                                    style={{
                                        minWidth: 0,
                                        flex: 1,
                                    }}
                                >
                                    <span className="atlas-media-name">
                                        {
                                            item.name
                                        }
                                    </span>

                                    <span
                                        className="atlas-media-meta"
                                        style={{
                                            display: "block",
                                        }}
                                    >
                                        {item.media_type.toUpperCase()}
                                        {" / "}
                                        {item.source_type ===
                                            "upload"
                                            ? "UPLOAD"
                                            : "LINK"}

                                        {item.source_type ===
                                            "upload" &&
                                            item.file_size
                                            ? ` / ${formatFileSize(
                                                item.file_size
                                            )}`
                                            : ""}
                                    </span>
                                </span>

                                <span
                                    style={{
                                        flex: "0 0 auto",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 9,
                                        color: "rgba(141, 228, 255, 0.72)",
                                        fontSize: 8,
                                        letterSpacing: "0.14em",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {primaryActionLabel}
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            color: "var(--atlas-blue)",
                                            fontSize: 13,
                                            lineHeight: 1,
                                        }}
                                    >
                                        →
                                    </span>
                                </span>
                            </button>

                            <div className="atlas-media-move">
                                <span>
                                    MOVE
                                </span>

                                <select
                                    value={
                                        item.folder_id ??
                                        ""
                                    }
                                    disabled={
                                        isMovingThis
                                    }
                                    onChange={(
                                        event
                                    ) => {
                                        const value =
                                            event.target.value;

                                        void handleMoveMedia(
                                            item,
                                            value ||
                                            null
                                        );
                                    }}
                                >
                                    <option value="">
                                        LOOSE CONTENT
                                    </option>

                                    {folders
                                        .filter(
                                            (folder) =>
                                                folder.moment_id ===
                                                item.moment_id
                                        )
                                        .map(
                                            (folder) => (
                                                <option
                                                    key={
                                                        folder.id
                                                    }
                                                    value={
                                                        folder.id
                                                    }
                                                >
                                                    {
                                                        folder.name
                                                    }
                                                </option>
                                            )
                                        )}
                                </select>
                            </div>

                            <div
                                className="atlas-media-actions"
                                style={{
                                    justifyContent: "flex-end",
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        startRename(
                                            item
                                        )
                                    }
                                >
                                    RENAME
                                </button>

                                <button
                                    type="button"
                                    className="atlas-media-delete"
                                    onClick={() =>
                                        void handleDeleteMedia(
                                            item
                                        )
                                    }
                                    disabled={
                                        isDeletingThis
                                    }
                                >
                                    {isDeletingThis
                                        ? "DELETING"
                                        : "DELETE"}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {renderPreview(
                    item
                )}
            </article>
        );
    };

    /* =========================================
       FOLDER BLOCK
    ========================================= */

    const renderFolderTile = (
        folder: AtlasMediaFolder
    ) => {
        const folderMedia =
            visibleMedia.filter(
                (item) =>
                    item.folder_id ===
                    folder.id
            );

        const isRenamingThis =
            renamingFolderId ===
            folder.id;

        const isDeletingThis =
            deletingFolderId ===
            folder.id;

        const isDragTarget =
            dragOverFolderId ===
            folder.id;

        return (
            <div
                key={
                    folder.id
                }
                role="button"
                tabIndex={0}
                onClick={() => {
                    if (
                        !isRenamingThis
                    ) {
                        setOpenFolderId(
                            folder.id
                        );
                    }
                }}
                onKeyDown={(
                    event
                ) => {
                    if (
                        event.key ===
                        "Enter" ||
                        event.key ===
                        " "
                    ) {
                        event.preventDefault();

                        if (
                            !isRenamingThis
                        ) {
                            setOpenFolderId(
                                folder.id
                            );
                        }
                    }
                }}
                onDragOver={(
                    event
                ) => {
                    if (
                        !draggedMediaId
                    ) {
                        return;
                    }

                    event.preventDefault();

                    event.dataTransfer.dropEffect =
                        "move";

                    setDragOverFolderId(
                        folder.id
                    );
                }}
                onDragLeave={(
                    event
                ) => {
                    const nextTarget =
                        event.relatedTarget as
                        Node | null;

                    if (
                        nextTarget &&
                        event.currentTarget.contains(
                            nextTarget
                        )
                    ) {
                        return;
                    }

                    setDragOverFolderId(
                        null
                    );
                }}
                onDrop={(
                    event
                ) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const mediaId =
                        draggedMediaId ||
                        event.dataTransfer.getData(
                            "text/plain"
                        );

                    const item =
                        media.find(
                            (mediaItem) =>
                                mediaItem.id ===
                                mediaId
                        );

                    setDragOverFolderId(
                        null
                    );

                    setDraggedMediaId(
                        null
                    );

                    if (!item) {
                        return;
                    }

                    void handleMoveMedia(
                        item,
                        folder.id
                    );
                }}
                style={{
                    position: "relative",
                    minHeight: 116,
                    padding: "18px 16px 14px",
                    border:
                        isDragTarget
                            ? "1px solid rgba(39, 199, 255, 0.62)"
                            : "1px solid rgba(141, 228, 255, 0.10)",
                    background:
                        isDragTarget
                            ? "rgba(39, 199, 255, 0.055)"
                            : "rgba(39, 199, 255, 0.016)",
                    boxShadow:
                        isDragTarget
                            ? "inset 0 0 28px rgba(39, 199, 255, 0.055)"
                            : "none",
                    cursor:
                        isRenamingThis
                            ? "default"
                            : "pointer",
                    transition:
                        "border-color 160ms ease, background 160ms ease, box-shadow 160ms ease",
                }}
            >
                {/* CSS-DRAWN FOLDER ICON */}
                <div
                    aria-hidden="true"
                    style={{
                        position: "relative",
                        width: 44,
                        height: 31,
                        marginBottom: 13,
                        border:
                            "1px solid rgba(39, 199, 255, 0.48)",
                        borderRadius: 3,
                        background:
                            "rgba(39, 199, 255, 0.055)",
                        boxShadow:
                            "0 0 14px rgba(39, 199, 255, 0.035)",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: 3,
                            top: -7,
                            width: 18,
                            height: 7,
                            border:
                                "1px solid rgba(39, 199, 255, 0.48)",
                            borderBottom: 0,
                            borderRadius:
                                "3px 3px 0 0",
                            background:
                                "rgba(7, 11, 16, 0.95)",
                        }}
                    />
                </div>

                {isRenamingThis ? (
                    <input
                        className="atlas-folder-rename-input"
                        value={
                            folderRenameValue
                        }
                        onClick={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                        onChange={(
                            event
                        ) =>
                            setFolderRenameValue(
                                event.target.value
                            )
                        }
                        onKeyDown={(
                            event
                        ) => {
                            if (
                                event.key ===
                                "Enter"
                            ) {
                                event.preventDefault();

                                void handleRenameFolder(
                                    folder.id
                                );
                            }

                            if (
                                event.key ===
                                "Escape"
                            ) {
                                event.preventDefault();

                                cancelRenameFolder();
                            }
                        }}
                        autoFocus
                    />
                ) : (
                    <div
                        style={{
                            overflow: "hidden",
                            color:
                                "rgba(241, 238, 230, 0.82)",
                            fontSize: 10,
                            letterSpacing:
                                "0.08em",
                            textOverflow:
                                "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {
                            folder.name
                        }
                    </div>
                )}

                <div
                    style={{
                        marginTop: 6,
                        color:
                            isDragTarget
                                ? "rgba(39, 199, 255, 0.9)"
                                : "rgba(141, 228, 255, 0.32)",
                        fontSize: 7,
                        letterSpacing:
                            "0.12em",
                    }}
                >
                    {isDragTarget
                        ? "DROP HERE"
                        : `${folderMedia.length} ${folderMedia.length ===
                            1
                            ? "ITEM"
                            : "ITEMS"
                        }`}
                </div>

                <div
                    onClick={(
                        event
                    ) =>
                        event.stopPropagation()
                    }
                    style={{
                        display: "flex",
                        gap: 9,
                        marginTop: 12,
                    }}
                >
                    {isRenamingThis ? (
                        <>
                            <button
                                type="button"
                                onClick={() =>
                                    void handleRenameFolder(
                                        folder.id
                                    )
                                }
                                disabled={
                                    isRenamingFolder
                                }
                                style={{
                                    appearance:
                                        "none",
                                    border: 0,
                                    padding: 0,
                                    background:
                                        "transparent",
                                    color:
                                        "var(--atlas-blue)",
                                    fontSize: 7,
                                    letterSpacing:
                                        "0.09em",
                                    cursor:
                                        "pointer",
                                }}
                            >
                                {isRenamingFolder
                                    ? "SAVING"
                                    : "SAVE"}
                            </button>

                            <button
                                type="button"
                                onClick={
                                    cancelRenameFolder
                                }
                                style={{
                                    appearance:
                                        "none",
                                    border: 0,
                                    padding: 0,
                                    background:
                                        "transparent",
                                    color:
                                        "rgba(241, 238, 230, 0.34)",
                                    fontSize: 7,
                                    letterSpacing:
                                        "0.09em",
                                    cursor:
                                        "pointer",
                                }}
                            >
                                CANCEL
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() =>
                                    startRenameFolder(
                                        folder
                                    )
                                }
                                style={{
                                    appearance:
                                        "none",
                                    border: 0,
                                    padding: 0,
                                    background:
                                        "transparent",
                                    color:
                                        "rgba(241, 238, 230, 0.28)",
                                    fontSize: 7,
                                    letterSpacing:
                                        "0.09em",
                                    cursor:
                                        "pointer",
                                }}
                            >
                                RENAME
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    void handleDeleteFolder(
                                        folder
                                    )
                                }
                                disabled={
                                    isDeletingThis
                                }
                                style={{
                                    appearance:
                                        "none",
                                    border: 0,
                                    padding: 0,
                                    background:
                                        "transparent",
                                    color:
                                        "rgba(255, 145, 145, 0.52)",
                                    fontSize: 7,
                                    letterSpacing:
                                        "0.09em",
                                    cursor:
                                        "pointer",
                                }}
                            >
                                {isDeletingThis
                                    ? "DELETING"
                                    : "DELETE"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderOpenFolderWorkspace = (
        folder: AtlasMediaFolder
    ) => {
        const folderMedia =
            visibleMedia.filter(
                (item) =>
                    item.folder_id ===
                    folder.id
            );

        const isDragTarget =
            dragOverFolderId ===
            folder.id;

        return (
            <div
                onDragOver={(
                    event
                ) => {
                    if (
                        !draggedMediaId
                    ) {
                        return;
                    }

                    event.preventDefault();

                    event.dataTransfer.dropEffect =
                        "move";

                    setDragOverFolderId(
                        folder.id
                    );
                }}
                onDragLeave={(
                    event
                ) => {
                    const nextTarget =
                        event.relatedTarget as
                        Node | null;

                    if (
                        nextTarget &&
                        event.currentTarget.contains(
                            nextTarget
                        )
                    ) {
                        return;
                    }

                    setDragOverFolderId(
                        null
                    );
                }}
                onDrop={(
                    event
                ) => {
                    event.preventDefault();

                    const mediaId =
                        draggedMediaId ||
                        event.dataTransfer.getData(
                            "text/plain"
                        );

                    const item =
                        media.find(
                            (mediaItem) =>
                                mediaItem.id ===
                                mediaId
                        );

                    setDragOverFolderId(
                        null
                    );

                    setDraggedMediaId(
                        null
                    );

                    if (!item) {
                        return;
                    }

                    void handleMoveMedia(
                        item,
                        folder.id
                    );
                }}
                style={{
                    minHeight: 220,
                    border:
                        isDragTarget
                            ? "1px solid rgba(39, 199, 255, 0.58)"
                            : "1px solid rgba(141, 228, 255, 0.10)",
                    background:
                        isDragTarget
                            ? "rgba(39, 199, 255, 0.04)"
                            : "rgba(7, 11, 16, 0.34)",
                    transition:
                        "border-color 160ms ease, background 160ms ease",
                }}
            >
                <div
                    style={{
                        minHeight: 54,
                        display: "flex",
                        alignItems:
                            "center",
                        gap: 12,
                        padding:
                            "0 14px",
                        borderBottom:
                            "1px solid rgba(255, 255, 255, 0.055)",
                    }}
                >
                    <button
                        type="button"
                        onClick={() =>
                            setOpenFolderId(
                                null
                            )
                        }
                        aria-label="Back to folders"
                        title="Folders"
                        style={{
                            appearance:
                                "none",
                            width: 28,
                            height: 28,
                            display: "grid",
                            placeItems:
                                "center",
                            border:
                                "1px solid rgba(39, 199, 255, 0.14)",
                            background:
                                "rgba(39, 199, 255, 0.02)",
                            color:
                                "var(--atlas-blue)",
                            fontSize: 18,
                            cursor:
                                "pointer",
                        }}
                    >
                        ‹
                    </button>

                    <div
                        style={{
                            minWidth: 0,
                            flex: 1,
                        }}
                    >
                        <div
                            style={{
                                overflow:
                                    "hidden",
                                color:
                                    "rgba(241, 238, 230, 0.82)",
                                fontSize: 10,
                                letterSpacing:
                                    "0.1em",
                                textOverflow:
                                    "ellipsis",
                                whiteSpace:
                                    "nowrap",
                            }}
                        >
                            {
                                folder.name
                            }
                        </div>

                        <div
                            style={{
                                marginTop: 4,
                                color:
                                    "rgba(141, 228, 255, 0.28)",
                                fontSize: 7,
                                letterSpacing:
                                    "0.1em",
                            }}
                        >
                            {folderMedia.length}
                            {" "}
                            {folderMedia.length ===
                                1
                                ? "ITEM"
                                : "ITEMS"}
                        </div>
                    </div>

                    <button
                        type="button"
                        title="Folder organization options coming soon"
                        aria-label="Folder options"
                        style={{
                            appearance:
                                "none",
                            width: 30,
                            height: 30,
                            border: 0,
                            background:
                                "transparent",
                            color:
                                "rgba(141, 228, 255, 0.42)",
                            fontSize: 13,
                            letterSpacing:
                                "0.08em",
                            cursor:
                                "default",
                        }}
                    >
                        •••
                    </button>
                </div>

                <div
                    style={{
                        maxHeight: 360,
                        overflowY: "auto",
                        padding:
                            "4px 14px 14px",
                    }}
                >
                    {folderMedia.length ===
                        0 ? (
                        <div
                            style={{
                                minHeight:
                                    145,
                                display:
                                    "grid",
                                placeItems:
                                    "center",
                                color:
                                    isDragTarget
                                        ? "rgba(39, 199, 255, 0.82)"
                                        : "rgba(241, 238, 230, 0.18)",
                                fontSize: 8,
                                letterSpacing:
                                    "0.12em",
                            }}
                        >
                            {isDragTarget
                                ? "DROP CONTENT HERE"
                                : "EMPTY FOLDER"}
                        </div>
                    ) : (
                        folderMedia.map(
                            renderMediaItem
                        )
                    )}
                </div>
            </div>
        );
    };

    const looseMedia =
        visibleMedia.filter(
            (item) =>
                item.folder_id ===
                null
        );

    const pinCoverMedia =
        selectedPin?.coverMediaId
            ? media.find(
                (item) =>
                    item.id ===
                    selectedPin.coverMediaId &&
                    item.media_type ===
                    "image"
            ) ??
            null
            : null;

    /* =========================================
       RENDER
    ========================================= */

    return (
        <aside className="atlas-panel">
            <div className="atlas-panel-scroll">
                {isEditing && (
                    <input
                        ref={
                            pinCoverInputRef
                        }
                        type="file"
                        accept="image/*"
                        style={{
                            display: "none",
                        }}
                        onChange={(
                            event
                        ) => {
                            const file =
                                event.target
                                    .files?.[0];

                            if (file) {
                                void handleUploadPinCover(
                                    file
                                );
                            }
                        }}
                    />
                )}

                {/* PIN HEADER */}

                <div className="atlas-pin-header">
                    <div className="atlas-pin-header-copy">
                        <div className="atlas-pin-header-kicker">
                            {isEditing
                                ? "PIN"
                                : "NEW PIN"}
                        </div>

                        <input
                            className="atlas-pin-header-title atlas-pin-header-title-input"
                            type="text"
                            value={title}
                            onChange={(event) =>
                                setTitle(
                                    event.target.value
                                )
                            }
                            placeholder="PIN NAME"
                            aria-label="Pin name"
                            maxLength={120}
                            autoFocus={
                                !isEditing
                            }
                        />
                    </div>

                    {isEditing && (
                        <div className="atlas-pin-menu-wrap">
                            <button
                                type="button"
                                className="atlas-pin-menu-button"
                                onClick={() =>
                                    setIsPinMenuOpen(
                                        (current) =>
                                            !current
                                    )
                                }
                                aria-expanded={
                                    isPinMenuOpen
                                }
                                aria-label="Pin actions"
                            >
                                ···
                            </button>

                            {isPinMenuOpen && (
                                <div className="atlas-pin-menu">
                                    <button
                                        type="button"
                                        disabled={
                                            isUploadingPinCover
                                        }
                                        onClick={() => {
                                            setPinCoverError(
                                                ""
                                            );

                                            pinCoverInputRef
                                                .current
                                                ?.click();
                                        }}
                                    >
                                        {selectedPin?.coverMediaId
                                            ? "CHANGE IMAGE"
                                            : "ADD IMAGE"}
                                    </button>

                                    {selectedPin?.coverMediaId && (
                                        <button
                                            type="button"
                                            disabled={
                                                isUploadingPinCover
                                            }
                                            onClick={() =>
                                                void handleRemovePinCover()
                                            }
                                        >
                                            REMOVE IMAGE
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActivePinTab(
                                                "overview"
                                            );

                                            setIsPinMenuOpen(
                                                false
                                            );

                                            setPinPositionError(
                                                ""
                                            );

                                            onStartRepositionPin();
                                        }}
                                    >
                                        EDIT PIN
                                    </button>

                                    <button
                                        type="button"
                                        className="is-danger"
                                        onClick={() => {
                                            setIsPinMenuOpen(
                                                false
                                            );

                                            void handleDelete();
                                        }}
                                    >
                                        DELETE PIN
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isEditing &&
                    pinCoverMedia && (
                        <div
                            style={{
                                position: "relative",
                                width: "100%",
                                height: 170,
                                marginBottom: 18,
                                overflow: "hidden",
                                border:
                                    "1px solid rgba(141, 228, 255, 0.10)",
                                borderRadius: 8,
                                background:
                                    "rgba(7, 11, 16, 0.42)",
                            }}
                        >
                            <img
                                src={
                                    pinCoverMedia.url
                                }
                                alt=""
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "block",
                                    objectFit: "cover",
                                }}
                            />

                            <div
                                aria-hidden="true"
                                style={{
                                    position:
                                        "absolute",
                                    inset: 0,
                                    pointerEvents:
                                        "none",
                                    background:
                                        "linear-gradient(180deg, transparent 45%, rgba(7, 11, 16, 0.34) 100%)",
                                }}
                            />
                        </div>
                    )}

                {isEditing &&
                    pinPositionError && (
                        <div
                            style={{
                                margin:
                                    "-8px 0 16px",
                                color:
                                    "rgba(255, 145, 145, 0.78)",
                                fontSize: 8,
                                letterSpacing:
                                    "0.08em",
                                lineHeight: 1.45,
                            }}
                        >
                            {
                                pinPositionError
                            }
                        </div>
                    )}

                {isEditing &&
                    pinCoverError && (
                        <div
                            style={{
                                margin:
                                    "-8px 0 16px",
                                color:
                                    "rgba(255, 145, 145, 0.78)",
                                fontSize: 8,
                                letterSpacing:
                                    "0.08em",
                                lineHeight: 1.45,
                            }}
                        >
                            {
                                pinCoverError
                            }
                        </div>
                    )}

                {(isEditing ||
                    draftPin) && (
                        <nav
                            className={`atlas-pin-tabs ${!isEditing
                                ? "is-draft"
                                : ""
                                }`}
                            aria-label="Pin workspace"
                        >
                            <button
                                type="button"
                                className={
                                    activePinTab ===
                                        "overview"
                                        ? "atlas-pin-tab is-active"
                                        : "atlas-pin-tab"
                                }
                                onClick={() =>
                                    setActivePinTab(
                                        "overview"
                                    )
                                }
                                aria-label="Overview"
                                aria-current={
                                    activePinTab ===
                                        "overview"
                                        ? "page"
                                        : undefined
                                }
                            >
                                <span
                                    className="atlas-pin-tab-sigil atlas-pin-tab-sigil--overview"
                                    aria-hidden="true"
                                >
                                    <span />
                                    <span />
                                    <span />
                                    <span />
                                </span>

                                <span className="atlas-pin-tab-label">
                                    OVERVIEW
                                </span>
                            </button>

                            <button
                                type="button"
                                className={
                                    activePinTab ===
                                        "content"
                                        ? "atlas-pin-tab is-active"
                                        : "atlas-pin-tab"
                                }
                                onClick={() =>
                                    setActivePinTab(
                                        "content"
                                    )
                                }
                                disabled={!isEditing}
                                aria-label="Content"
                                aria-current={
                                    activePinTab ===
                                        "content"
                                        ? "page"
                                        : undefined
                                }
                            >
                                <span
                                    className="atlas-pin-tab-sigil atlas-pin-tab-sigil--content"
                                    aria-hidden="true"
                                />

                                <span className="atlas-pin-tab-label">
                                    CONTENT
                                </span>
                            </button>

                            <button
                                type="button"
                                className={
                                    activePinTab ===
                                        "people"
                                        ? "atlas-pin-tab is-active"
                                        : "atlas-pin-tab"
                                }
                                onClick={() =>
                                    setActivePinTab(
                                        "people"
                                    )
                                }
                                disabled={!isEditing}
                                aria-label="People"
                                aria-current={
                                    activePinTab ===
                                        "people"
                                        ? "page"
                                        : undefined
                                }
                            >
                                <span
                                    className="atlas-pin-tab-sigil atlas-pin-tab-sigil--people"
                                    aria-hidden="true"
                                >
                                    <span className="atlas-pin-tab-person-head" />
                                    <span className="atlas-pin-tab-person-body" />
                                </span>

                                <span className="atlas-pin-tab-label">
                                    PEOPLE
                                </span>
                            </button>

                            <button
                                type="button"
                                className={
                                    activePinTab ===
                                        "tasks"
                                        ? "atlas-pin-tab is-active"
                                        : "atlas-pin-tab"
                                }
                                onClick={() =>
                                    setActivePinTab(
                                        "tasks"
                                    )
                                }
                                disabled={!isEditing}
                                aria-label="Tasks"
                                aria-current={
                                    activePinTab ===
                                        "tasks"
                                        ? "page"
                                        : undefined
                                }
                            >
                                <span
                                    className="atlas-pin-tab-sigil atlas-pin-tab-sigil--tasks"
                                    aria-hidden="true"
                                >
                                    <span />
                                </span>

                                <span className="atlas-pin-tab-label">
                                    TASKS
                                </span>
                            </button>
                        </nav>
                    )}

                <div
                    className={
                        isEditing &&
                            activePinTab !==
                            "overview"
                            ? "atlas-tab-panel is-hidden"
                            : "atlas-tab-panel"
                    }
                >
                    {/* DESCRIPTION */}

                    <label className="atlas-pin-description">
                        <textarea
                            value={description}
                            onChange={(event) =>
                                setDescription(
                                    event.target.value.slice(
                                        0,
                                        180
                                    )
                                )
                            }
                            placeholder="Description..."
                            rows={3}
                            maxLength={180}
                            aria-label="Description"
                        />

                        <span className="atlas-pin-description-count">
                            {description.length}/180
                        </span>
                    </label>

                    {(draftPin?.formattedAddress ||
                        selectedPin?.formattedAddress) && (
                            <div className="atlas-place-identity">
                                <div className="atlas-place-identity-label">
                                    GOOGLE PLACE
                                </div>

                                <div className="atlas-place-identity-address">
                                    {draftPin?.formattedAddress ??
                                        selectedPin?.formattedAddress}
                                </div>
                            </div>
                        )}

                    {/* STATE */}

                    <div
                        className={`atlas-field atlas-state-field ${isDateLocked
                            ? "is-date-locked"
                            : ""
                            }`}
                    >
                        <div className="atlas-state-options">
                            {(
                                [
                                    "past",
                                    "present",
                                    "future",
                                ] as AtlasTimeState[]
                            ).map(
                                (state) => {
                                    const isActive =
                                        isDateLocked
                                            ? derivedTimeStates.includes(
                                                state
                                            )
                                            : timeState ===
                                            state;

                                    return (
                                        <button
                                            key={
                                                state
                                            }
                                            type="button"
                                            className={
                                                isActive
                                                    ? "is-active"
                                                    : ""
                                            }
                                            disabled={
                                                isDateLocked
                                            }
                                            aria-disabled={
                                                isDateLocked
                                            }
                                            onClick={() => {
                                                if (
                                                    isDateLocked
                                                ) {
                                                    return;
                                                }

                                                setTimeState(
                                                    state
                                                );
                                            }}
                                        >
                                            {state.toUpperCase()}
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>

                    {/* MOMENTS */}

                    {(selectedPin ||
                        draftPin) && (
                            <div className="atlas-field atlas-moments-field">
                                <span>
                                    MOMENTS
                                </span>

                                <div className="atlas-moment-ribbon">
                                    <button
                                        type="button"
                                        className={`atlas-moment-chip ${selectedMomentIds.length ===
                                            0
                                            ? "is-active"
                                            : ""
                                            }`}
                                        onClick={() => {
                                            setSelectedMomentIds(
                                                []
                                            );

                                            resetMomentForm();
                                        }}
                                    >
                                        ALL
                                    </button>

                                    {moments.map(
                                        (moment) => (
                                            <button
                                                key={
                                                    moment.id
                                                }
                                                type="button"
                                                className={`atlas-moment-chip ${selectedMomentIds.includes(
                                                    moment.id
                                                )
                                                    ? "is-active"
                                                    : ""
                                                    }`}
                                                onClick={() => {
                                                    setSelectedMomentIds(
                                                        [
                                                            moment.id,
                                                        ]
                                                    );

                                                    resetMomentForm();
                                                }}
                                                title={
                                                    moment.title ??
                                                    formatMomentLongDate(
                                                        moment
                                                    )
                                                }
                                            >
                                                {formatMomentChip(
                                                    moment
                                                )}
                                            </button>
                                        )
                                    )}

                                    <button
                                        type="button"
                                        className="atlas-moment-chip atlas-moment-chip--add"
                                        onClick={
                                            openNewMomentForm
                                        }
                                        aria-label="Add moment"
                                    >
                                        +
                                    </button>
                                </div>

                                {isLoadingMoments && (
                                    <div className="atlas-moment-status">
                                        LOADING MOMENTS...
                                    </div>
                                )}

                                {momentError && (
                                    <div className="atlas-media-error atlas-moment-error">
                                        {momentError}
                                    </div>
                                )}

                                {selectedMoment &&
                                    !isMomentFormOpen && (
                                        <div className="atlas-moment-summary">
                                            <div className="atlas-moment-summary-main">
                                                <div className="atlas-moment-summary-date">
                                                    {formatMomentLongDate(
                                                        selectedMoment
                                                    )}
                                                </div>

                                                {selectedMoment.title && (
                                                    <div className="atlas-moment-summary-title">
                                                        {
                                                            selectedMoment.title
                                                        }
                                                    </div>
                                                )}

                                                {selectedMoment.notes && (
                                                    <div className="atlas-moment-summary-notes">
                                                        {
                                                            selectedMoment.notes
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div className="atlas-moment-summary-actions">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openEditMomentForm(
                                                            selectedMoment
                                                        )
                                                    }
                                                >
                                                    EDIT
                                                </button>

                                                <button
                                                    type="button"
                                                    className="atlas-moment-delete"
                                                    onClick={() =>
                                                        void handleDeleteMoment(
                                                            selectedMoment
                                                        )
                                                    }
                                                    disabled={
                                                        deletingMomentId ===
                                                        selectedMoment.id
                                                    }
                                                >
                                                    {deletingMomentId ===
                                                        selectedMoment.id
                                                        ? "DELETING"
                                                        : "DELETE"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                {isMomentFormOpen && (
                                    <div className="atlas-moment-form">
                                        <div className="atlas-moment-type-row">
                                            {(
                                                [
                                                    "date",
                                                    "datetime",
                                                    "range",
                                                ] as AtlasMomentFormType[]
                                            ).map(
                                                (type) => (
                                                    <button
                                                        key={
                                                            type
                                                        }
                                                        type="button"
                                                        className={
                                                            momentFormType ===
                                                                type
                                                                ? "is-active"
                                                                : ""
                                                        }
                                                        onClick={() => {
                                                            setMomentFormType(
                                                                type
                                                            );

                                                            if (
                                                                type !==
                                                                "range"
                                                            ) {
                                                                setMomentEnd(
                                                                    ""
                                                                );
                                                            }

                                                            if (
                                                                type ===
                                                                "datetime" &&
                                                                momentStart &&
                                                                !momentStart.includes(
                                                                    "T"
                                                                )
                                                            ) {
                                                                setMomentStart(
                                                                    `${momentStart}T12:00`
                                                                );
                                                            }

                                                            if (
                                                                type !==
                                                                "datetime" &&
                                                                momentStart.includes(
                                                                    "T"
                                                                )
                                                            ) {
                                                                setMomentStart(
                                                                    momentStart.split(
                                                                        "T"
                                                                    )[0]
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        {type ===
                                                            "datetime"
                                                            ? "DATE + TIME"
                                                            : type ===
                                                                "range"
                                                                ? "RANGE"
                                                                : "DATE"}
                                                    </button>
                                                )
                                            )}
                                        </div>

                                        <label className="atlas-moment-form-field">
                                            <span>
                                                LABEL
                                            </span>

                                            <input
                                                type="text"
                                                value={
                                                    momentTitle
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setMomentTitle(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Optional"
                                            />
                                        </label>

                                        <label className="atlas-moment-form-field">
                                            <span>
                                                {momentFormType ===
                                                    "range"
                                                    ? "START"
                                                    : "WHEN"}
                                            </span>

                                            <input
                                                type={
                                                    momentFormType ===
                                                        "datetime"
                                                        ? "datetime-local"
                                                        : "date"
                                                }
                                                value={
                                                    momentStart
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setMomentStart(
                                                        event.target.value
                                                    )
                                                }
                                            />
                                        </label>

                                        {momentFormType ===
                                            "range" && (
                                                <label className="atlas-moment-form-field">
                                                    <span>
                                                        END
                                                    </span>

                                                    <input
                                                        type="date"
                                                        value={
                                                            momentEnd
                                                        }
                                                        min={
                                                            momentStart ||
                                                            undefined
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setMomentEnd(
                                                                event.target.value
                                                            )
                                                        }
                                                    />
                                                </label>
                                            )}

                                        <label className="atlas-moment-form-field">
                                            <span>
                                                NOTE
                                            </span>

                                            <textarea
                                                value={
                                                    momentNotes
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setMomentNotes(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Optional context..."
                                                rows={2}
                                            />
                                        </label>

                                    </div>
                                )}

                                {moments.length ===
                                    0 &&
                                    !isLoadingMoments &&
                                    !isMomentFormOpen && (
                                        <div className="atlas-moment-status">
                                            ADD A DATE WHEN THIS PLACE BECOMES MORE DEFINITE.
                                        </div>
                                    )}
                            </div>
                        )}

                    {/* COLLECTIONS */}

                    <div className="atlas-field">
                        <span>
                            COLLECTIONS
                        </span>

                        <div className="atlas-panel-collections">
                            {collections.length ===
                                0 ? (
                                <div className="atlas-panel-empty">
                                    NO COLLECTIONS
                                </div>
                            ) : (
                                collections.map(
                                    (
                                        collection
                                    ) => {
                                        const selected =
                                            selectedCollections.includes(
                                                collection.id
                                            );

                                        return (
                                            <button
                                                key={
                                                    collection.id
                                                }
                                                type="button"
                                                className={
                                                    selected
                                                        ? "is-active"
                                                        : ""
                                                }
                                                onClick={() =>
                                                    toggleCollection(
                                                        collection.id
                                                    )
                                                }
                                                aria-pressed={
                                                    selected
                                                }
                                            >
                                                {
                                                    collection.name
                                                }
                                            </button>
                                        );
                                    }
                                )
                            )}
                        </div>
                    </div>

                    {/* NOTES */}

                    <div className="atlas-pin-notes">
                        <button
                            type="button"
                            className={
                                isNotesOpen
                                    ? "atlas-pin-notes-toggle is-open"
                                    : "atlas-pin-notes-toggle"
                            }
                            onClick={() =>
                                setIsNotesOpen(
                                    (current) =>
                                        !current
                                )
                            }
                            aria-expanded={
                                isNotesOpen
                            }
                        >
                            <span>NOTES</span>
                            <span
                                className="atlas-pin-notes-arrow"
                                aria-hidden="true"
                            >
                                ›
                            </span>
                        </button>

                        {isNotesOpen && (
                            <textarea
                                className="atlas-pin-notes-textarea"
                                value={notes}
                                onChange={(event) =>
                                    setNotes(
                                        event.target.value
                                    )
                                }
                                placeholder="Notes, context, ideas..."
                                rows={6}
                                aria-label="Pin notes"
                            />
                        )}
                    </div>

                </div>

                {/* PEOPLE */}

                {isEditing &&
                    selectedPin && (
                        <section
                            className={`atlas-content atlas-people atlas-tab-panel ${activePinTab ===
                                "people"
                                ? ""
                                : "is-hidden"
                                }`}
                        >
                            <div className="atlas-content-heading-row">
                                <div className="atlas-content-heading">
                                    PEOPLE
                                </div>

                                <div className="atlas-content-count">
                                    {visiblePersonRelationships.length}
                                    {" "}
                                    {visiblePersonRelationships.length ===
                                        1
                                        ? "PERSON"
                                        : "PEOPLE"}
                                </div>
                            </div>

                            {selectedMomentIds.length >
                                0 && (
                                    <div className="atlas-moment-status">
                                        {selectedMomentIds.length ===
                                            1
                                            ? "SHOWING PEOPLE FOR THIS MOMENT."
                                            : "SHOWING THE UNION OF SELECTED MOMENTS. SELECT ONE MOMENT TO ADD SOMEONE."}
                                    </div>
                                )}

                            {peopleError && (
                                <div className="atlas-media-error">
                                    {peopleError}
                                </div>
                            )}

                            {isLoadingPeople && (
                                <div className="atlas-panel-empty">
                                    LOADING PEOPLE...
                                </div>
                            )}

                            {!isLoadingPeople &&
                                visiblePersonRelationships.length >
                                0 && (
                                    <div className="atlas-panel-collections">
                                        {visiblePersonRelationships.map(
                                            (relationship) => {
                                                const person =
                                                    relationship.person;

                                                const contextMoment =
                                                    relationship.moment_id
                                                        ? moments.find(
                                                            (moment) =>
                                                                moment.id ===
                                                                relationship.moment_id
                                                        )
                                                        : null;

                                                return (
                                                    <button
                                                        key={
                                                            relationship.id
                                                        }
                                                        type="button"
                                                        onClick={() =>
                                                            openEditPersonForm(
                                                                relationship
                                                            )
                                                        }
                                                        title={
                                                            [
                                                                person.headline,
                                                                relationship.role_in_context,
                                                                contextMoment
                                                                    ? formatMomentChip(
                                                                        contextMoment
                                                                    )
                                                                    : "ALL",
                                                            ]
                                                                .filter(Boolean)
                                                                .join(
                                                                    " · "
                                                                )
                                                        }
                                                    >
                                                        {person.avatar_url && (
                                                            <img
                                                                src={
                                                                    person.avatar_url
                                                                }
                                                                alt=""
                                                                style={{
                                                                    width:
                                                                        22,
                                                                    height:
                                                                        22,
                                                                    objectFit:
                                                                        "cover",
                                                                    borderRadius:
                                                                        4,
                                                                    marginRight:
                                                                        7,
                                                                    verticalAlign:
                                                                        "middle",
                                                                }}
                                                            />
                                                        )}

                                                        <span>
                                                            {
                                                                person.name
                                                                    .split(
                                                                        /\s+/
                                                                    )[0]
                                                            }
                                                        </span>

                                                        {contextMoment && (
                                                            <small
                                                                style={{
                                                                    marginLeft:
                                                                        6,
                                                                    opacity:
                                                                        0.58,
                                                                }}
                                                            >
                                                                {formatMomentChip(
                                                                    contextMoment
                                                                )}
                                                            </small>
                                                        )}
                                                    </button>
                                                );
                                            }
                                        )}
                                    </div>
                                )}

                            {!isLoadingPeople &&
                                visiblePersonRelationships.length ===
                                0 &&
                                !isPersonFormOpen && (
                                    <div className="atlas-panel-empty">
                                        NO PEOPLE IN THIS STATE
                                    </div>
                                )}

                            {!isPersonFormOpen && (
                                <button
                                    type="button"
                                    className="atlas-new-collection"
                                    onClick={
                                        openNewPersonForm
                                    }
                                    disabled={
                                        isMultiMomentSelection
                                    }
                                >
                                    + PERSON
                                </button>
                            )}

                            {isPersonFormOpen && (
                                <div className="atlas-content-tool">
                                    <div
                                        style={{
                                            width:
                                                "100%",
                                        }}
                                    >
                                        <div className="atlas-content-heading-row">
                                            <div className="atlas-content-tool-title">
                                                {personFormMode ===
                                                    "edit"
                                                    ? "PERSON"
                                                    : "ADD PERSON"}
                                            </div>

                                            {personFormMode !==
                                                "edit" && (
                                                    <div className="atlas-panel-collections">
                                                        <button
                                                            type="button"
                                                            className={
                                                                personFormMode ===
                                                                    "new"
                                                                    ? "is-active"
                                                                    : ""
                                                            }
                                                            onClick={() => {
                                                                setPersonFormMode(
                                                                    "new"
                                                                );

                                                                setPeopleError(
                                                                    ""
                                                                );
                                                            }}
                                                        >
                                                            NEW
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className={
                                                                personFormMode ===
                                                                    "existing"
                                                                    ? "is-active"
                                                                    : ""
                                                            }
                                                            onClick={() => {
                                                                setPersonFormMode(
                                                                    "existing"
                                                                );

                                                                setPeopleError(
                                                                    ""
                                                                );
                                                            }}
                                                        >
                                                            EXISTING
                                                        </button>
                                                    </div>
                                                )}
                                        </div>

                                        {personFormMode ===
                                            "existing" ? (
                                            <>
                                                <label className="atlas-field">
                                                    <span>
                                                        PERSON
                                                    </span>

                                                    <select
                                                        value={
                                                            selectedExistingPersonId
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setSelectedExistingPersonId(
                                                                event.target.value
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            CHOOSE PERSON
                                                        </option>

                                                        {availableExistingPeople.map(
                                                            (
                                                                person
                                                            ) => (
                                                                <option
                                                                    key={
                                                                        person.id
                                                                    }
                                                                    value={
                                                                        person.id
                                                                    }
                                                                >
                                                                    {person.name}
                                                                    {person.headline
                                                                        ? ` · ${person.headline}`
                                                                        : ""}
                                                                </option>
                                                            )
                                                        )}
                                                    </select>
                                                </label>

                                                {availableExistingPeople.length ===
                                                    0 && (
                                                        <div className="atlas-moment-status">
                                                            EVERY SAVED PERSON IS ALREADY IN THIS STATE.
                                                        </div>
                                                    )}
                                            </>
                                        ) : (
                                            <>
                                                <div
                                                    className={`atlas-dropzone ${isDraggingPersonImage
                                                        ? "is-dragging"
                                                        : ""
                                                        }`}
                                                    onDragEnter={
                                                        handlePersonImageDragOver
                                                    }
                                                    onDragOver={
                                                        handlePersonImageDragOver
                                                    }
                                                    onDragLeave={
                                                        handlePersonImageDragLeave
                                                    }
                                                    onDrop={
                                                        handlePersonImageDrop
                                                    }
                                                    onClick={() =>
                                                        personImageInputRef.current?.click()
                                                    }
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(
                                                        event
                                                    ) => {
                                                        if (
                                                            event.key ===
                                                            "Enter" ||
                                                            event.key ===
                                                            " "
                                                        ) {
                                                            personImageInputRef.current?.click();
                                                        }
                                                    }}
                                                >
                                                    <input
                                                        ref={
                                                            personImageInputRef
                                                        }
                                                        type="file"
                                                        accept="image/*"
                                                        className="atlas-file-input"
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            choosePersonImage(
                                                                event.target.files?.[0] ??
                                                                null
                                                            )
                                                        }
                                                    />

                                                    {personAvatarPreview ? (
                                                        <img
                                                            src={
                                                                personAvatarPreview
                                                            }
                                                            alt=""
                                                            style={{
                                                                width:
                                                                    72,
                                                                height:
                                                                    72,
                                                                objectFit:
                                                                    "cover",
                                                                borderRadius:
                                                                    8,
                                                                marginBottom:
                                                                    8,
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="atlas-dropzone-title">
                                                            DROP PHOTO
                                                        </div>
                                                    )}

                                                    <div className="atlas-dropzone-subtitle">
                                                        drop an image or click to browse
                                                    </div>
                                                </div>

                                                <label className="atlas-field">
                                                    <span>
                                                        IMAGE URL
                                                    </span>

                                                    <input
                                                        type="url"
                                                        value={
                                                            personAvatarUrl
                                                        }
                                                        onChange={(
                                                            event
                                                        ) => {
                                                            const value =
                                                                event.target.value;

                                                            setPersonAvatarUrl(
                                                                value
                                                            );

                                                            if (
                                                                !personAvatarFile
                                                            ) {
                                                                setPersonAvatarPreview(
                                                                    value
                                                                );
                                                            }
                                                        }}
                                                        placeholder="https://..."
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        NAME
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={
                                                            personName
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonName(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Susan"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        HEADLINE
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={
                                                            personHeadline
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonHeadline(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Designer · NYC"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        COMPANY
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={
                                                            personCompany
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonCompany(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Studio / organization"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        CITY
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={
                                                            personCity
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonCity(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="New York"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        ROLES
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={
                                                            personRoles
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonRoles(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Designer, Creative Director"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        TAGS
                                                    </span>

                                                    <input
                                                        type="text"
                                                        value={
                                                            personTags
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonTags(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="Collaborator, Friend"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        EMAIL
                                                    </span>

                                                    <input
                                                        type="email"
                                                        value={
                                                            personEmail
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonEmail(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="name@example.com"
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        PHONE
                                                    </span>

                                                    <input
                                                        type="tel"
                                                        value={
                                                            personPhone
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonPhone(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="+1 ..."
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        WEBSITE
                                                    </span>

                                                    <input
                                                        type="url"
                                                        value={
                                                            personWebsite
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonWebsite(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="https://..."
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        BIRTHDAY
                                                    </span>

                                                    <input
                                                        type="date"
                                                        value={
                                                            personBirthday
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonBirthday(
                                                                event.target.value
                                                            )
                                                        }
                                                    />
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        RELATIONSHIP
                                                    </span>

                                                    <select
                                                        value={
                                                            personRelationshipState
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonRelationshipState(
                                                                event.target.value as
                                                                AtlasPerson["relationship_state"]
                                                            )
                                                        }
                                                    >
                                                        <option value="active">
                                                            ACTIVE
                                                        </option>

                                                        <option value="hiatus">
                                                            HIATUS
                                                        </option>

                                                        <option value="dormant">
                                                            DORMANT
                                                        </option>

                                                        <option value="potential">
                                                            POTENTIAL
                                                        </option>

                                                        <option value="archived">
                                                            ARCHIVED
                                                        </option>
                                                    </select>
                                                </label>

                                                <label className="atlas-field">
                                                    <span>
                                                        PERSON NOTES
                                                    </span>

                                                    <textarea
                                                        value={
                                                            personNotes
                                                        }
                                                        onChange={(
                                                            event
                                                        ) =>
                                                            setPersonNotes(
                                                                event.target.value
                                                            )
                                                        }
                                                        placeholder="What matters about this person overall..."
                                                        rows={4}
                                                    />
                                                </label>
                                            </>
                                        )}

                                        <label className="atlas-field">
                                            <span>
                                                ROLE HERE
                                            </span>

                                            <input
                                                type="text"
                                                value={
                                                    personRoleInContext
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setPersonRoleInContext(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Designer on Kindred"
                                            />
                                        </label>

                                        <label className="atlas-field">
                                            <span>
                                                NOTES HERE
                                            </span>

                                            <textarea
                                                value={
                                                    personContextNotes
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setPersonContextNotes(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Why this person matters in this place / moment..."
                                                rows={3}
                                            />
                                        </label>

                                        <div className="atlas-new-collection-actions">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void handleSavePerson()
                                                }
                                                disabled={
                                                    isSavingPerson ||
                                                    (
                                                        personFormMode ===
                                                            "existing"
                                                            ? !selectedExistingPersonId
                                                            : !personName.trim()
                                                    )
                                                }
                                            >
                                                {isSavingPerson
                                                    ? "SAVING..."
                                                    : personFormMode ===
                                                        "edit"
                                                        ? "SAVE PERSON"
                                                        : "ADD PERSON"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    resetPersonForm
                                                }
                                                disabled={
                                                    isSavingPerson
                                                }
                                            >
                                                CANCEL
                                            </button>
                                        </div>

                                        {personFormMode ===
                                            "edit" && (
                                                <button
                                                    type="button"
                                                    className="atlas-delete-button"
                                                    onClick={() =>
                                                        void handleRemovePersonFromState()
                                                    }
                                                    disabled={
                                                        removingPersonRelationshipId !==
                                                        null
                                                    }
                                                >
                                                    {removingPersonRelationshipId
                                                        ? "REMOVING..."
                                                        : "REMOVE FROM THIS STATE"}
                                                </button>
                                            )}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                {/* TASKS */}

                {isEditing &&
                    selectedPin && (
                        <section
                            className={`atlas-content atlas-tasks atlas-tab-panel ${activePinTab ===
                                "tasks"
                                ? ""
                                : "is-hidden"
                                }`}
                        >
                            <div className="atlas-content-heading-row">
                                <div className="atlas-content-heading">
                                    TASKS
                                </div>

                                <div className="atlas-content-count">
                                    {activeTasks.length}
                                    {" "}
                                    {activeTasks.length ===
                                        1
                                        ? "OPEN"
                                        : "OPEN"}
                                </div>
                            </div>

                            {selectedMomentIds.length >
                                0 && (
                                    <div className="atlas-moment-status">
                                        {selectedMomentIds.length ===
                                            1
                                            ? "SHOWING TASKS FOR THIS MOMENT."
                                            : "SHOWING THE UNION OF SELECTED MOMENTS. SELECT ONE MOMENT TO ADD A TASK."}
                                    </div>
                                )}

                            {taskError && (
                                <div className="atlas-media-error">
                                    {taskError}
                                </div>
                            )}

                            <div className="atlas-task-create">
                                <input
                                    type="text"
                                    value={
                                        newTaskTitle
                                    }
                                    maxLength={50}
                                    onChange={(
                                        event
                                    ) =>
                                        setNewTaskTitle(
                                            event.target.value
                                        )
                                    }
                                    onKeyDown={(
                                        event
                                    ) => {
                                        if (
                                            event.key ===
                                            "Enter"
                                        ) {
                                            event.preventDefault();

                                            void handleCreateTask();
                                        }
                                    }}
                                    placeholder="Add a task..."
                                    disabled={
                                        isMultiMomentSelection ||
                                        isCreatingTask
                                    }
                                />

                                <div className="atlas-task-create-meta">
                                    <span>
                                        {newTaskTitle.length}/50
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleCreateTask()
                                        }
                                        disabled={
                                            isCreatingTask ||
                                            isMultiMomentSelection ||
                                            !newTaskTitle.trim()
                                        }
                                    >
                                        {isCreatingTask
                                            ? "ADDING..."
                                            : "+ ADD TASK"}
                                    </button>
                                </div>
                            </div>

                            {isLoadingTasks && (
                                <div className="atlas-panel-empty atlas-content-empty">
                                    LOADING TASKS...
                                </div>
                            )}

                            {!isLoadingTasks &&
                                activeTasks.length ===
                                0 &&
                                completedTasks.length ===
                                0 && (
                                    <div className="atlas-panel-empty atlas-content-empty">
                                        NO TASKS IN THIS STATE
                                    </div>
                                )}

                            {!isLoadingTasks &&
                                activeTasks.length >
                                0 && (
                                    <div className="atlas-task-list">
                                        {activeTasks.map(
                                            (task) => (
                                                <div
                                                    key={task.id}
                                                    className="atlas-task-row"
                                                >
                                                    <button
                                                        type="button"
                                                        className="atlas-task-check"
                                                        onClick={() =>
                                                            void handleToggleTask(
                                                                task
                                                            )
                                                        }
                                                        disabled={
                                                            updatingTaskId ===
                                                            task.id
                                                        }
                                                        aria-label={`Complete ${task.title}`}
                                                    >
                                                        <span />
                                                    </button>

                                                    {editingTaskId ===
                                                        task.id ? (
                                                        <input
                                                            type="text"
                                                            className="atlas-task-rename-input"
                                                            value={
                                                                editingTaskTitle
                                                            }
                                                            maxLength={50}
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                setEditingTaskTitle(
                                                                    event.target.value
                                                                )
                                                            }
                                                            onKeyDown={(
                                                                event
                                                            ) => {
                                                                if (
                                                                    event.key ===
                                                                    "Enter"
                                                                ) {
                                                                    event.preventDefault();

                                                                    void handleRenameTask();
                                                                }

                                                                if (
                                                                    event.key ===
                                                                    "Escape"
                                                                ) {
                                                                    event.preventDefault();
                                                                    cancelRenameTask();
                                                                }
                                                            }}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="atlas-task-title"
                                                            onClick={() =>
                                                                beginRenameTask(
                                                                    task
                                                                )
                                                            }
                                                            title="Click to rename"
                                                        >
                                                            {task.title}
                                                        </button>
                                                    )}

                                                    <div className="atlas-task-actions">
                                                        {editingTaskId ===
                                                            task.id && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            void handleRenameTask()
                                                                        }
                                                                        disabled={
                                                                            updatingTaskId ===
                                                                            task.id
                                                                        }
                                                                    >
                                                                        SAVE
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={
                                                                            cancelRenameTask
                                                                        }
                                                                    >
                                                                        CANCEL
                                                                    </button>
                                                                </>
                                                            )}

                                                        <button
                                                            type="button"
                                                            className="atlas-task-delete"
                                                            onClick={() =>
                                                                void handleDeleteTask(
                                                                    task
                                                                )
                                                            }
                                                            disabled={
                                                                deletingTaskId ===
                                                                task.id
                                                            }
                                                        >
                                                            {deletingTaskId ===
                                                                task.id
                                                                ? "..."
                                                                : "DELETE"}
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}

                            {!isLoadingTasks &&
                                completedTasks.length >
                                0 && (
                                    <section className="atlas-task-completed">
                                        <div className="atlas-task-completed-heading">
                                            COMPLETED
                                            <span>
                                                {completedTasks.length}
                                            </span>
                                        </div>

                                        <div className="atlas-task-list">
                                            {completedTasks.map(
                                                (task) => (
                                                    <div
                                                        key={task.id}
                                                        className="atlas-task-row is-complete"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="atlas-task-check is-complete"
                                                            onClick={() =>
                                                                void handleToggleTask(
                                                                    task
                                                                )
                                                            }
                                                            disabled={
                                                                updatingTaskId ===
                                                                task.id
                                                            }
                                                            aria-label={`Reopen ${task.title}`}
                                                        >
                                                            <span>
                                                                ✓
                                                            </span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="atlas-task-title"
                                                            onClick={() =>
                                                                beginRenameTask(
                                                                    task
                                                                )
                                                            }
                                                            title="Click to rename"
                                                        >
                                                            {task.title}
                                                        </button>

                                                        <div className="atlas-task-actions">
                                                            <button
                                                                type="button"
                                                                className="atlas-task-delete"
                                                                onClick={() =>
                                                                    void handleDeleteTask(
                                                                        task
                                                                    )
                                                                }
                                                                disabled={
                                                                    deletingTaskId ===
                                                                    task.id
                                                                }
                                                            >
                                                                {deletingTaskId ===
                                                                    task.id
                                                                    ? "..."
                                                                    : "DELETE"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </section>
                                )}
                        </section>
                    )}

                {/* CONTENT */}

                {isEditing &&
                    selectedPin && (
                        <section
                            className={`atlas-content atlas-tab-panel ${activePinTab ===
                                "content"
                                ? ""
                                : "is-hidden"
                                }`}
                        >
                            <div className="atlas-content-heading-row">
                                <div className="atlas-content-heading">
                                    CONTENT
                                </div>

                                <div className="atlas-content-count">
                                    {visibleMedia.length}
                                    {" "}
                                    {visibleMedia.length ===
                                        1
                                        ? "ITEM"
                                        : "ITEMS"}
                                </div>
                            </div>

                            {selectedMomentIds.length >
                                0 && (
                                    <div className="atlas-moment-status">
                                        {selectedMomentIds.length ===
                                            1
                                            ? "SHOWING CONTENT FOR THIS MOMENT."
                                            : "SHOWING THE UNION OF SELECTED MOMENTS. SELECT ONE MOMENT TO ADD NEW CONTENT."}
                                    </div>
                                )}

                            {/* DROP */}

                            <div
                                className={`atlas-dropzone ${isDraggingFile
                                    ? "is-dragging"
                                    : ""
                                    }`}
                                onDragEnter={
                                    handleDragOver
                                }
                                onDragOver={
                                    handleDragOver
                                }
                                onDragLeave={
                                    handleDragLeave
                                }
                                onDrop={
                                    handleDrop
                                }
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                                role="button"
                                tabIndex={0}
                                onKeyDown={(
                                    event
                                ) => {
                                    if (
                                        event.key ===
                                        "Enter" ||
                                        event.key ===
                                        " "
                                    ) {
                                        fileInputRef.current?.click();
                                    }
                                }}
                            >
                                <input
                                    ref={
                                        fileInputRef
                                    }
                                    type="file"
                                    className="atlas-file-input"
                                    onChange={(
                                        event
                                    ) =>
                                        chooseFile(
                                            event.target
                                                .files?.[0] ??
                                            null
                                        )
                                    }
                                />

                                <div className="atlas-dropzone-title">
                                    DROP CONTENT HERE
                                </div>

                                <div className="atlas-dropzone-subtitle">
                                    files, images, video or links · click to browse
                                </div>
                            </div>

                            {/* UPLOAD READY */}

                            {selectedFile && (
                                <div className="atlas-content-tool">
                                    <div className="atlas-content-tool-info">
                                        <div className="atlas-content-tool-title">
                                            {
                                                selectedFile.name
                                            }
                                        </div>

                                        <div className="atlas-content-tool-meta">
                                            READY TO UPLOAD
                                            {" / "}
                                            {formatFileSize(
                                                selectedFile.size
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleUploadMedia()
                                        }
                                        disabled={
                                            isUploading ||
                                            isMultiMomentSelection
                                        }
                                    >
                                        {isUploading
                                            ? "UPLOADING"
                                            : "UPLOAD"}
                                    </button>
                                </div>
                            )}

                            {/* FOLDER CREATION */}

                            <div className="atlas-folder-toolbar">
                                {isNewFolderOpen ? (
                                    <>
                                        <input
                                            className="atlas-content-tool-input"
                                            type="text"
                                            value={
                                                newFolderName
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setNewFolderName(
                                                    event.target.value
                                                )
                                            }
                                            onKeyDown={(
                                                event
                                            ) => {
                                                if (
                                                    event.key ===
                                                    "Enter"
                                                ) {
                                                    event.preventDefault();

                                                    void handleCreateFolder();
                                                }

                                                if (
                                                    event.key ===
                                                    "Escape"
                                                ) {
                                                    event.preventDefault();

                                                    setIsNewFolderOpen(
                                                        false
                                                    );

                                                    setNewFolderName(
                                                        ""
                                                    );
                                                }
                                            }}
                                            placeholder="Folder name"
                                            autoFocus
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleCreateFolder()
                                            }
                                            disabled={
                                                isCreatingFolder ||
                                                !newFolderName.trim()
                                            }
                                        >
                                            {isCreatingFolder
                                                ? "CREATING"
                                                : "CREATE"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsNewFolderOpen(
                                                    false
                                                );

                                                setNewFolderName(
                                                    ""
                                                );
                                            }}
                                        >
                                            CANCEL
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsNewFolderOpen(
                                                    true
                                                )
                                            }
                                            disabled={
                                                isMultiMomentSelection
                                            }
                                        >
                                            + NEW FOLDER
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* ERRORS */}

                            {folderError && (
                                <div className="atlas-media-error">
                                    {
                                        folderError
                                    }
                                </div>
                            )}

                            {mediaError && (
                                <div className="atlas-media-error">
                                    {
                                        mediaError
                                    }
                                </div>
                            )}

                            {/* LOADING */}

                            {(isLoadingMedia ||
                                isLoadingFolders) && (
                                    <div className="atlas-panel-empty atlas-content-empty">
                                        LOADING CONTENT...
                                    </div>
                                )}

                            {/* FOLDER WORKSPACE */}

                            {!isLoadingFolders && (
                                <section
                                    style={{
                                        marginTop: 18,
                                        marginBottom: 20,
                                    }}
                                >
                                    {openFolderId ? (
                                        (() => {
                                            const openFolder =
                                                visibleFolders.find(
                                                    (folder) =>
                                                        folder.id ===
                                                        openFolderId
                                                );

                                            return openFolder
                                                ? renderOpenFolderWorkspace(
                                                    openFolder
                                                )
                                                : null;
                                        })()
                                    ) : (
                                        <div
                                            style={{
                                                border:
                                                    "1px solid rgba(141, 228, 255, 0.10)",
                                                background:
                                                    "rgba(7, 11, 16, 0.34)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    minHeight: 54,
                                                    display:
                                                        "flex",
                                                    alignItems:
                                                        "center",
                                                    justifyContent:
                                                        "flex-end",
                                                    gap: 12,
                                                    padding:
                                                        "0 14px",
                                                    borderBottom:
                                                        "1px solid rgba(255, 255, 255, 0.055)",
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    title="Folder organization options coming soon"
                                                    aria-label="Folder options"
                                                    style={{
                                                        appearance:
                                                            "none",
                                                        width: 30,
                                                        height: 30,
                                                        border: 0,
                                                        background:
                                                            "transparent",
                                                        color:
                                                            "rgba(141, 228, 255, 0.42)",
                                                        fontSize: 13,
                                                        letterSpacing:
                                                            "0.08em",
                                                        cursor:
                                                            "default",
                                                    }}
                                                >
                                                    •••
                                                </button>
                                            </div>

                                            <div
                                                style={{
                                                    maxHeight: 288,
                                                    overflowY:
                                                        "auto",
                                                    padding: 14,
                                                }}
                                            >
                                                {visibleFolders.length ===
                                                    0 ? (
                                                    <div
                                                        style={{
                                                            minHeight:
                                                                92,
                                                            display:
                                                                "grid",
                                                            placeItems:
                                                                "center",
                                                            color:
                                                                "rgba(241, 238, 230, 0.16)",
                                                            fontSize: 8,
                                                            letterSpacing:
                                                                "0.12em",
                                                        }}
                                                    >
                                                        CREATE A FOLDER TO ORGANIZE CONTENT
                                                    </div>
                                                ) : (
                                                    <div
                                                        style={{
                                                            display:
                                                                "grid",
                                                            gridTemplateColumns:
                                                                "repeat(auto-fit, minmax(132px, 1fr))",
                                                            gap: 10,
                                                        }}
                                                    >
                                                        {visibleFolders.map(
                                                            renderFolderTile
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* ROOT MEDIA — content outside folders */}

                            {!isLoadingMedia && (
                                <section
                                    onDragOver={(
                                        event
                                    ) => {
                                        if (
                                            !draggedMediaId
                                        ) {
                                            return;
                                        }

                                        event.preventDefault();

                                        event.dataTransfer.dropEffect =
                                            "move";
                                    }}
                                    onDrop={(
                                        event
                                    ) => {
                                        event.preventDefault();

                                        const mediaId =
                                            draggedMediaId ||
                                            event.dataTransfer.getData(
                                                "text/plain"
                                            );

                                        const item =
                                            media.find(
                                                (mediaItem) =>
                                                    mediaItem.id ===
                                                    mediaId
                                            );

                                        setDraggedMediaId(
                                            null
                                        );

                                        setDragOverFolderId(
                                            null
                                        );

                                        if (!item) {
                                            return;
                                        }

                                        void handleMoveMedia(
                                            item,
                                            null
                                        );
                                    }}
                                >
                                    {looseMedia.length ===
                                        0 ? (
                                        <div
                                            style={{
                                                padding:
                                                    "18px 0",
                                                color:
                                                    "rgba(241, 238, 230, 0.14)",
                                                fontSize: 8,
                                                letterSpacing:
                                                    "0.1em",
                                            }}
                                        >
                                            NO CONTENT OUTSIDE FOLDERS
                                        </div>
                                    ) : (
                                        looseMedia.map(
                                            renderMediaItem
                                        )
                                    )}
                                </section>
                            )}
                        </section>
                    )}

                {/* COORDINATES */}

                {(!isEditing ||
                    activePinTab ===
                    "overview") && (
                        <div className="atlas-coordinates">
                            {activeLocation.latitude.toFixed(
                                4
                            )}
                            ,{" "}
                            {activeLocation.longitude.toFixed(
                                4
                            )}
                        </div>
                    )}
            </div>

            {/* CONTEXTUAL OVERVIEW / MOMENT ACTIONS */}

            {(!isEditing ||
                activePinTab ===
                "overview") && (
                    <div className="atlas-panel-actions">
                        <button
                            type="button"
                            onClick={
                                isRepositioningPin
                                    ? onCancelRepositionPin
                                    : isMomentFormOpen
                                        ? resetMomentForm
                                        : onCancel
                            }
                            disabled={
                                isSaving ||
                                isDeleting ||
                                isSavingMoment ||
                                isSavingPinPosition
                            }
                        >
                            {isRepositioningPin
                                ? "CANCEL"
                                : isMomentFormOpen
                                    ? "CANCEL"
                                    : isEditing
                                        ? "CLOSE"
                                        : "CANCEL"}
                        </button>

                        <button
                            type="button"
                            className="atlas-save"
                            onClick={() => {
                                if (
                                    isRepositioningPin
                                ) {
                                    void handleSavePinPosition();
                                    return;
                                }

                                if (
                                    isEditing &&
                                    isMomentFormOpen
                                ) {
                                    void handleSaveMoment();
                                    return;
                                }

                                void handleSave();
                            }}
                            disabled={
                                isRepositioningPin
                                    ? isSavingPinPosition
                                    : isEditing &&
                                        isMomentFormOpen
                                        ? (
                                            isSavingMoment ||
                                            !momentStart ||
                                            (
                                                momentFormType ===
                                                "range" &&
                                                !momentEnd
                                            )
                                        )
                                        : !isEditing &&
                                            isMomentFormOpen
                                            ? (
                                                isSaving ||
                                                !title.trim() ||
                                                !momentStart ||
                                                (
                                                    momentFormType ===
                                                    "range" &&
                                                    !momentEnd
                                                )
                                            )
                                            : (
                                                isSaving ||
                                                isDeleting ||
                                                !title.trim()
                                            )
                            }
                        >
                            {isRepositioningPin
                                ? isSavingPinPosition
                                    ? "SAVING..."
                                    : "SAVE POSITION"
                                : isEditing &&
                                    isMomentFormOpen
                                    ? isSavingMoment
                                        ? "SAVING..."
                                        : editingMomentId
                                            ? "SAVE MOMENT"
                                            : "ADD MOMENT"
                                    : isSaving
                                        ? "SAVING..."
                                        : isEditing
                                            ? "SAVE OVERVIEW"
                                            : isMomentFormOpen
                                                ? "SAVE PIN + MOMENT"
                                                : "SAVE PIN"}
                        </button>
                    </div>
                )}
        </aside>
    );
}